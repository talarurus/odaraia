// SPDX-License-Identifier: MPL-2.0
import AppKit
import QuartzCore

// Shared preference validation and native backing. Experimental WebKit/WindowServer
// composition is isolated in DesktopGlass.swift and ExperimentalGlassBridge.m.
struct GlassPreferences {
 var glass:Double = 0.55
 init(_ raw:[String:Any] = [:]) {
  if let number=raw["glass"] as? NSNumber,CFGetTypeID(number) != CFBooleanGetTypeID(),number.doubleValue.isFinite { glass=min(1,max(0,number.doubleValue)) }
  else if let legacy=raw["intensity"] as? String { glass=["low":0.1,"medium":0.55,"high":0.9][legacy] ?? 0.55 }
 }
 var dictionary:[String:Any] { ["version":2,"glass":glass] }
 var veilAlpha:Double { 1-0.94*glass }
 var panelAlpha:Double { 1 }
 var nativeTintAlpha:Double { 1-0.85*glass }
 // Full proof range remains deliberately separate from readable product tint.
 // A neutral tint limits backdrop extremes without replacing desktop glass.
 // At maximum intensity, retain 22% desktop influence in Dark / 32% in Light.
 func readableTintAlpha(dark:Bool)->Double { 1-(dark ? 0.22:0.32)*glass }
}
final class GlassBackdrop:NSView {
 let effect=NSVisualEffectView(),veil=NSView()
 override var isOpaque:Bool { false }
 override init(frame:NSRect) {
  super.init(frame:frame)
  effect.material = .underWindowBackground;effect.blendingMode = .behindWindow;effect.state = .followsWindowActiveState
  for view in [effect,veil]{view.translatesAutoresizingMaskIntoConstraints=false;addSubview(view);NSLayoutConstraint.activate([view.leadingAnchor.constraint(equalTo:leadingAnchor),view.trailingAnchor.constraint(equalTo:trailingAnchor),view.topAnchor.constraint(equalTo:topAnchor),view.bottomAnchor.constraint(equalTo:bottomAnchor)])}
  veil.wantsLayer=true
 }
 required init?(coder:NSCoder){fatalError("Programmatic view")}
 func apply(window:NSWindow,translucent:Bool,dark:Bool,preferences:GlassPreferences){
  effect.state=translucent ? .followsWindowActiveState:.inactive
  let solid=NSColor(calibratedRed:dark ? 32/255:239/255,green:dark ? 35/255:241/255,blue:dark ? 40/255:243/255,alpha:1)
  window.isOpaque = !translucent;window.backgroundColor=translucent ? .clear:solid
  // Public materials choose their own blur. This is a neutral contrast veil.
  CATransaction.begin();CATransaction.setDisableActions(true)
  veil.layer?.backgroundColor=(translucent ? NSColor(calibratedWhite:dark ? 0.08:0.965,alpha:preferences.veilAlpha):solid).cgColor
  CATransaction.commit()
 }
}
