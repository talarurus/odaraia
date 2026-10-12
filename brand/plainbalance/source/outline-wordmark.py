# SPDX-License-Identifier: MPL-2.0
"""Generate font-independent SVG paths from the unchanged, OFL-licensed Inter source.

Run with Python 3, fonttools[woff] and uharfbuzz installed. Settings and live-text
SVGs remain editable. No system font, browser font fallback or corporate SVG is read.
"""
from pathlib import Path
from io import BytesIO
import json,hashlib,html
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

root=Path(__file__).resolve().parent
settings=json.loads((root/'wordmark.json').read_text())
fontfile=root/settings['fontFile']
assert hashlib.sha256(fontfile.read_bytes()).hexdigest()==settings['fontSHA256'],'Font source changed; review its provenance before regeneration.'

def outline(text,weight,size,tracking,baseline):
    variable=TTFont(fontfile)
    static=instantiateVariableFont(variable,{'wght':weight},inplace=False)
    static.flavor=None
    data=BytesIO();static.save(data)
    face=hb.Face(data.getvalue());font=hb.Font(face)
    font.scale=(face.upem,face.upem)
    buffer=hb.Buffer();buffer.add_str(text);buffer.guess_segment_properties()
    hb.shape(font,buffer,settings['shaping'])
    glyphs=static.getGlyphSet();order=static.getGlyphOrder()
    scale=size/face.upem;x=0;paths=[]
    for info,pos in zip(buffer.glyph_infos,buffer.glyph_positions):
        pen=SVGPathPen(glyphs)
        transform=TransformPen(pen,(scale,0,0,-scale,x+pos.x_offset*scale,baseline-pos.y_offset*scale))
        glyphs[order[info.codepoint]].draw(transform)
        paths.append(pen.getCommands())
        x+=pos.x_advance*scale+tracking*size
    return paths,x-tracking*size

word,width=outline(settings['product'],settings['wordmarkWeight'],settings['wordmarkSize'],settings['wordmarkTrackingEm'],settings['wordmarkBaseline'])
by,_=outline(settings['attribution'],settings['attributionWeight'],settings['attributionSize'],settings['attributionTrackingEm'],settings['attributionBaseline'])
width=round(width+1,3)
for lockup in [False,True]:
    label=settings['product']+(' '+settings['attribution'] if lockup else '')
    height=settings['lockupHeight'] if lockup else settings['wordmarkHeight']
    prefix='lockup' if lockup else 'wordmark'
    for theme,color in settings['colors'].items():
        name=prefix+('-white' if theme=='white' else '')+'.svg'
        paths=word+(by if lockup else [])
        content=f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="identity-title"><title id="identity-title">{html.escape(label)}</title><g fill="{color}">'+''.join('<path d="'+p+'"/>' for p in paths)+'</g></svg>\n'
        (root.parent/name).write_text(content.replace('\\n','\n'))
    # Editable live text is a source, never the final export.
    live=f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><title>{html.escape(label)} — editable source</title><text x="0" y="40" fill="#111111" font-family="Inter" font-size="40" font-weight="500" letter-spacing="-1.6">plainbalance</text>'
    if lockup:live+='<text x="0" y="69" fill="#111111" font-family="Inter" font-size="14" font-weight="400" letter-spacing="0">by Talarurus</text>'
    (root/(prefix+'-editable.svg')).write_text(live+'</svg>\n')
print(json.dumps({'outlinedExports':4,'font':settings['font'],'wordmarkWidth':width,'attributionSize':settings['attributionSize'],'externalFontDependenciesInExports':0}))
