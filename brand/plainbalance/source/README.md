# Editable plainbalance wordmark source

`wordmark-editable.svg` and `lockup-editable.svg` retain live text for editing. Load the supplied Inter font when editing; these files are source materials, not final distribution exports. `wordmark.json` controls text, weight, size, tracking and baselines. The 40px medium lowercase wordmark uses −0.04em tracking; `by Talarurus` is secondary regular 14px text with normal spacing. This is ordinary publisher attribution, not the official corporate wordmark. Display the complete lockup at least 200px wide so attribution remains approximately 12px or larger. At smaller widths use a wordmark with readable live attribution elsewhere.

Regeneration, from the finance workspace, with Python 3 and the listed packages installed:

```sh
python3 -m pip install -r brand/plainbalance/source/requirements.txt
python3 brand/plainbalance/source/outline-wordmark.py
```

The generator shapes the retained, hash-checked Inter 4.001 font with HarfBuzz and outlines its glyphs with fontTools. It emits the four final SVGs one directory above, containing only vector paths with ink/white fills. No system font, browser fallback or corporate artwork is read. The WOFF2 font is unchanged and uses OFL-1.1; its complete original license is in `fonts/OFL.txt`. The generator and original settings/documentation use MPL-2.0. Keep those file-level distinctions when redistributing. Dependencies are development tools, not application runtime additions.
