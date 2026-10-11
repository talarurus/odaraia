// SPDX-License-Identifier: MIT
import AppKit
import WebKit

// One interface, two compile-time implementations. The public fallback is
// fully opaque. The private branch requires a second explicit runtime flag.
final class DesktopGlassBackend {
 static var enabledForReview:Bool {
  #if ODARAIA_EXPERIMENTAL_GLASS
  return CommandLine.arguments.contains("--experimental-desktop-glass")
  #else
  return false
  #endif
 }
 private(set) var configured=false
 private(set) var active=false
 private(set) var lastError=""
 private(set) var blurStatus:Int=0
 private(set) var blurCallAttempted=false
 private(set) var appliedRadius=0
 private(set) var tintAlpha:Double=1
 var available:Bool { Self.enabledForReview && configured }
 func configure(_ configuration:WKWebViewConfiguration) {
  #if ODARAIA_EXPERIMENTAL_GLASS
  guard Self.enabledForReview else{return}
  let probe=ODAGlassProbe()
  guard probe["blurSymbolAvailable"] as? Bool == true,probe["connectionSymbolAvailable"] as? Bool == true else{lastError="Private WindowServer symbols unavailable. Solid fallback.";return}
  configured=ODAGlassConfigure(configuration)
  if !configured{lastError="Private WebKit background configuration rejected. Solid fallback."}
  #endif
 }
 @discardableResult func apply(window:NSWindow,web:WKWebView,backdrop:GlassBackdrop,wantsGlass:Bool,dark:Bool,preferences:GlassPreferences,radius:Int=64,unrestrictedProof:Bool=false)->Bool {
  #if ODARAIA_EXPERIMENTAL_GLASS
  let enable=wantsGlass && available
  if enable {
   if !active, !ODAGlassSetDrawing(web,false){lastError="WebKit refused transparent background. Solid fallback.";return solid(window:window,web:web,backdrop:backdrop,dark:dark)}
   web.underPageBackgroundColor=NSColor(srgbRed:0,green:0,blue:0,alpha:3/255)
   // NSWindow owns the sole tint; freshly exposed resize edges do not wait
   // for React/WebKit to paint. A 1% native effect stabilizes the backing.
   backdrop.effect.isHidden=false;backdrop.effect.alphaValue=0.01;backdrop.effect.state = .active
   backdrop.veil.isHidden=true
   window.isOpaque=false
   tintAlpha=unrestrictedProof ? preferences.nativeTintAlpha:preferences.readableTintAlpha(dark:dark)
   window.backgroundColor=palette(dark:dark).withAlphaComponent(tintAlpha)
   if !active{window.hasShadow=true;window.titlebarSeparatorStyle = .none;window.invalidateShadow()}
   let clamped=min(64,max(1,radius))
   if !active || appliedRadius != clamped {
    appliedRadius=clamped
    blurCallAttempted=true;blurStatus=ODAGlassBlur(window,clamped)
    guard blurStatus==0 else{lastError="WindowServer blur rejected (\(blurStatus)). Solid fallback.";return solid(window:window,web:web,backdrop:backdrop,dark:dark)}
   }
   active=true;lastError="";return true
  }
  #endif
  return solid(window:window,web:web,backdrop:backdrop,dark:dark)
 }
 private func palette(dark:Bool)->NSColor { NSColor(srgbRed:dark ? 32/255:239/255,green:dark ? 35/255:241/255,blue:dark ? 40/255:243/255,alpha:1) }
 private func solid(window:NSWindow,web:WKWebView,backdrop:GlassBackdrop,dark:Bool)->Bool {
  #if ODARAIA_EXPERIMENTAL_GLASS
  if Self.enabledForReview && configured {
   if active || appliedRadius>0 {let status=ODAGlassBlur(window,0);if status != 0{lastError="Blur reset rejected (\(status)); opaque fallback applied."}}
   if !ODAGlassSetDrawing(web,true){lastError="WebKit background restoration rejected; opaque CSS/window fallback applied."}
  }
  #endif
  active=false;appliedRadius=0;tintAlpha=1;backdrop.effect.isHidden=true;backdrop.veil.isHidden=true
  window.isOpaque=true;window.backgroundColor=palette(dark:dark);web.underPageBackgroundColor=palette(dark:dark)
  window.invalidateShadow();return false
 }
 func teardown(window:NSWindow,web:WKWebView,backdrop:GlassBackdrop,dark:Bool){_ = solid(window:window,web:web,backdrop:backdrop,dark:dark)}
 var diagnostics:[String:Any] { ["compiledPrivateBackend":Self.compiledPrivateBackend,"runtimeOptIn":Self.enabledForReview,"webBackgroundConfigured":configured,"available":available,"active":active,"blurCallAttempted":blurCallAttempted,"blurStatus":blurCallAttempted ? String(blurStatus):"NOT_CALLED","appliedRadius":appliedRadius,"nativeTintAlpha":tintAlpha,"lastError":lastError,"visualAcceptance":"UNVERIFIED"] }
 static var compiledPrivateBackend:Bool {
  #if ODARAIA_EXPERIMENTAL_GLASS
  return true
  #else
  return false
  #endif
 }
}
