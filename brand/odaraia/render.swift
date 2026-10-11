// SPDX-License-Identifier: MPL-2.0
import AppKit
import Foundation
let root=URL(fileURLWithPath:CommandLine.arguments[1],isDirectory:true)
func render(_ source:URL,_ target:URL,_ pixels:Int)throws{
 guard let image=NSImage(contentsOf:source),let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:pixels,pixelsHigh:pixels,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0),let context=NSGraphicsContext(bitmapImageRep:bitmap) else{fatalError("Could not load SVG: \(source.path)")}
 NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=context;image.draw(in:NSRect(x:0,y:0,width:pixels,height:pixels),from:.zero,operation:.copy,fraction:1);NSGraphicsContext.restoreGraphicsState()
 try bitmap.representation(using:.png,properties:[:])!.write(to:target)
}
// Source preview renders only the active neutral placeholder. Archived concepts stay private.
let placeholder=root.appendingPathComponent("placeholder",isDirectory:true)
for size in [16,32,64,128,256,512,1024]{try render(placeholder.appendingPathComponent("app-icon.svg"),placeholder.appendingPathComponent("icon-\(size).png"),size)}
