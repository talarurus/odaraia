// SPDX-License-Identifier: MPL-2.0
import AppKit
import WebKit
import Foundation
import Security
import Darwin
import QuartzCore

struct Downloads:Decodable {let transactions:String;let backup:String}
struct Product: Decodable { let name:String; let publisher:String; let version:String; let bundleIdentifier:String; let dataIdentifier:String;let downloads:Downloads }
umask(0o077)
let resourceRoot = Bundle.main.resourceURL!
let product = try JSONDecoder().decode(Product.self, from: Data(contentsOf: resourceRoot.appendingPathComponent("product.json")))
let arguments = CommandLine.arguments
let testIndex = arguments.firstIndex(of: "--smoke-test")
let testDirectory: URL? = testIndex.flatMap { $0+1 < arguments.count ? URL(fileURLWithPath:arguments[$0+1],isDirectory:true) : nil }
let dataDirectory = testDirectory ?? FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent(product.dataIdentifier,isDirectory:true)

// Public AppKit drag handling. Web content cannot issue arbitrary window operations.
final class ToolbarView:NSView {
 override var isFlipped:Bool { true }
 override func mouseDown(with event:NSEvent){ window?.performDrag(with:event) }
}
final class FlippedView:NSView { override var isFlipped:Bool { true } }
final class TopAnchoredStack:NSStackView { override var isFlipped:Bool { true } }
final class TopAnchoredClip:NSClipView { override var isFlipped:Bool { true } }
final class SidebarButton:NSButton {
 let selectionLayer=CALayer()
 var motionDisabled:()->Bool={NSWorkspace.shared.accessibilityDisplayShouldReduceMotion}
 var selected=false { didSet { updateSelection();setAccessibilityValue(selected ? "Selected":"") } }
 var hovered=false
 override func viewDidMoveToWindow(){super.viewDidMoveToWindow();wantsLayer=true;selectionLayer.cornerRadius=9;layer?.insertSublayer(selectionLayer,at:0);updateSelection()}
 override func layout(){super.layout();CATransaction.begin();CATransaction.setDisableActions(true);selectionLayer.frame=bounds.insetBy(dx:0,dy:2);CATransaction.commit()}
 override func updateTrackingAreas(){for area in trackingAreas{removeTrackingArea(area)};addTrackingArea(NSTrackingArea(rect:bounds,options:[.mouseEnteredAndExited,.activeInKeyWindow,.inVisibleRect],owner:self,userInfo:nil));super.updateTrackingAreas()}
 override func mouseEntered(with event:NSEvent){hovered=true;updateSelection()}
 override func mouseExited(with event:NSEvent){hovered=false;updateSelection()}
 func updateSelection(){
  let old=selectionLayer.presentation()?.opacity ?? selectionLayer.opacity
  let color=selected ? NSColor.controlAccentColor.withAlphaComponent(0.14):NSColor.labelColor.withAlphaComponent(0.045)
  CATransaction.begin();CATransaction.setDisableActions(true);selectionLayer.backgroundColor=color.cgColor;selectionLayer.opacity=selected || hovered ? 1:0;CATransaction.commit()
  if !motionDisabled(){let fade=CABasicAnimation(keyPath:"opacity");fade.fromValue=old;fade.toValue=selectionLayer.opacity;fade.duration=0.13;fade.timingFunction=CAMediaTimingFunction(name:.easeOut);selectionLayer.add(fade,forKey:"selection")}else{selectionLayer.removeAllAnimations()}
 }
}

final class AppDelegate:NSObject,NSApplicationDelegate,WKNavigationDelegate,WKUIDelegate,WKScriptMessageHandler,NSWindowDelegate,NSPopoverDelegate {
 var window:NSWindow!; var web:WKWebView!;var shellRoot=FlippedView();var sidebar=FlippedView();var toolbarMaterial=NSView();var toolbarLabel=NSTextField(labelWithString:"")
 var child:Process?;var input:Pipe?;var output:Pipe?;var errorPipe:Pipe?;var startupTimer:Timer?;var terminationTimer:Timer?
 var origin:URL?;var lockDescriptor:Int32 = -1;var terminating=false;var stdoutBuffer=Data();var appearanceObserver:NSKeyValueObservation?
 var loadingView=NSView();var backdrop=GlassBackdrop();var webHost=NSView();var nativeSearch=NSSearchField();var appearancePopover=NSPopover();var appearanceSegments:[String:NSSegmentedControl]=[:];var appearanceSlider:NSSlider?;var appearanceValue:NSTextField?;weak var appearanceAnchor:NSButton?;var escapeMonitor:Any?;var restorePopoverFocus=false
 let desktopGlass=DesktopGlassBackend()
 var glassPaintReady=false
 var startupSolidOverride=arguments.contains("--startup-solid")
 var lastMaterialLog:Double=0;var lastResizeLog:Double=0
 var effectiveWindow:String { desktopGlass.active && !reducedTransparency ? "translucent":"solid" }
 var sidebarTextColors:[(NSTextField,NSColor)]=[]
 var nativeBrand:NSView!;var navScroll:NSScrollView!;var navStack:NSStackView!;var statusTitle:NSTextField!;var statusDetail:NSTextField!;var retryButton:NSButton!;var workspaceTimer:Timer?;var startupStage="NATIVE_PROCESS_STARTED";var startupFailure="";var navigationCompleted=false;var backendErrorCode="";var workspaceAttempt=0
 var sidebarWidth:NSLayoutConstraint!;var sidebarMargins:[NSLayoutConstraint]=[];var navigationWidths:[NSLayoutConstraint]=[];var sidebarHeadings:[NSView]=[];var brandCopy:NSView!;var sidebarFooter:NSView!;var sidebarToggle:NSButton!;var sidebarMenuItem:NSMenuItem?
 var sidebarCollapsed:Bool { defaults.object(forKey:"odaraia.sidebarCollapsed") as? Bool ?? false }

 var navigation:[SidebarButton]=[];var currentPage="dashboard";var launchToken="";var ready=false;var workspaceReady=false;var workspaceVerified=false;var smokeExitScheduled=false
 // Isolated review launches must not change the founder's normal preferences.
 let defaults=testDirectory.map { UserDefaults(suiteName:"com.talarurus.odaraia.review." + $0.lastPathComponent)! } ?? UserDefaults.standard
 let destinations=[("dashboard","Overview","square.grid.2x2"),("accounts","Accounts","building.columns"),("cashflow","Cash flow","arrow.triangle.branch"),("spending","Spending","chart.pie"),("transactions","Transactions","list.bullet.rectangle"),("networth","Net worth","chart.xyaxis.line"),("budgets","Budgets","slider.horizontal.3"),("import","Import CSV","square.and.arrow.down"),("settings","Settings","gearshape")]
 var requestedWindow:String { if startupSolidOverride{return "solid"};return (defaults.string(forKey:"talarurus.windowAppearance") ?? (DesktopGlassBackend.enabledForReview ? "translucent":"solid"))=="translucent" ? "translucent":"solid" }
 var theme:String { let value=defaults.string(forKey:"talarurus.appearance") ?? "system";return ["system","light","dark"].contains(value) ? value:"system" }
 var material:[String:Any] { GlassPreferences(defaults.dictionary(forKey:"talarurus.material") ?? (DesktopGlassBackend.enabledForReview ? ["glass":0.8]:[:])).dictionary }
 func normalizedMaterial(_ raw:[String:Any])->[String:Any]{GlassPreferences(raw).dictionary}
 func emitAppearance(){
  let state:[String:Any]=["windowAppearance":requestedWindow,"effectiveWindowAppearance":effectiveWindow,"translucencyAvailable":desktopGlass.available,"compositingMode":desktopGlass.active ? "native-desktop-glass":"solid","glassDiagnostics":desktopGlass.diagnostics,"theme":theme,"material":material,"reduceTransparency":reducedTransparency,"reduceMotion":reducedMotion]
  let json=String(data:try! JSONSerialization.data(withJSONObject:state),encoding:.utf8)!
  web?.evaluateJavaScript("Object.assign(window.__ODARAIA_NATIVE__||{},\(json));window.dispatchEvent(new CustomEvent('odaraia-appearance',{detail:\(json)}));",completionHandler:nil)
  syncAppearanceControls()
 }
 var reducedTransparency:Bool { NSWorkspace.shared.accessibilityDisplayShouldReduceTransparency }
 var reducedMotion:Bool { NSWorkspace.shared.accessibilityDisplayShouldReduceMotion || (defaults.dictionary(forKey:"talarurus.presentation")?["reduceMotion"] as? Bool ?? false) }

 var diagnosticsDirectory:URL { testDirectory ?? dataDirectory.appendingPathComponent("diagnostics",isDirectory:true) }
 func record(_ status:String,_ detail:String="") {
  let directory=diagnosticsDirectory
  guard !terminating || status=="STOPPED" else{return}
  try? FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true,attributes:[.posixPermissions:0o700])
  guard (try? directory.resourceValues(forKeys:[.isSymbolicLinkKey]).isSymbolicLink)==false else{return}
  let object:[String:Any]=["status":status,"detail":detail,"time":ISO8601DateFormatter().string(from:Date()),"storageScope":testDirectory != nil ? "isolated-review":product.dataIdentifier,"startupStage":startupStage,"startupFailure":startupFailure,"glassDiagnostics":desktopGlass.diagnostics,"sidebarCollapsed":sidebarCollapsed,"sidebarWidth":sidebarWidth?.constant ?? 0,"backendReady":ready,"workspaceReady":workspaceReady,"workspaceVerified":workspaceVerified,"windowVisible":window?.isVisible ?? false,"backendPID":child?.processIdentifier ?? 0,"backendOrigin":origin?.absoluteString ?? "","pid":ProcessInfo.processInfo.processIdentifier,"layout":layoutSnapshot()]
  func write(_ name:String,_ bytes:Data,_ append:Bool){let fd=Darwin.open(directory.appendingPathComponent(name).path,O_WRONLY|O_CREAT|O_NOFOLLOW|(append ? O_APPEND:O_TRUNC),0o600);guard fd>=0 else{return};defer{Darwin.close(fd)};_ = Darwin.fchmod(fd,0o600);bytes.withUnsafeBytes{buffer in if let address=buffer.baseAddress{_ = Darwin.write(fd,address,buffer.count)}}}
  if let bytes=try? JSONSerialization.data(withJSONObject:object,options:.prettyPrinted){write("native-result.json",bytes,false)}
  if var bytes=try? JSONSerialization.data(withJSONObject:object){bytes.append(10);write("native-events.jsonl",bytes,true)}
 }
 func stage(_ value:String){startupStage=value;if startupFailure.isEmpty{statusDetail?.stringValue=["BACKEND_SPAWNED":"Waiting for the local service to listen.","BACKEND_READY":"Loading the financial application.","NAVIGATION_COMPLETED":"Initializing the financial workspace.","SESSION_ESTABLISHED":"Reading saved local records.","STATE_FETCHED":"Rendering your financial workspace."][value] ?? statusDetail?.stringValue ?? "Starting plainbalance."};record(value)}
 func layoutSnapshot()->[String:Any]{
  func rect(_ view:NSView?)->[Double]{guard let view=view,view===shellRoot || view.isDescendant(of:shellRoot) else{return []};let r=shellRoot.convert(view.bounds,from:view);return [r.minX,r.minY,r.width,r.height]}
  return ["root":rect(shellRoot),"sidebar":rect(sidebar),"brand":rect(nativeBrand),"navigation":rect(navScroll),"workspace":rect(webHost),"web":rect(web),"loading":rect(loadingView),"rootAmbiguous":shellRoot.hasAmbiguousLayout,"sidebarAmbiguous":sidebar.hasAmbiguousLayout]
 }
 func applicationDidFinishLaunching(_ notification:Notification) {
  stage("NATIVE_PROCESS_STARTED")
  do {
   try FileManager.default.createDirectory(at:dataDirectory,withIntermediateDirectories:true,attributes:[.posixPermissions:0o700])
   guard (try dataDirectory.resourceValues(forKeys:[.isSymbolicLinkKey])).isSymbolicLink != true else { throw NSError(domain:"Odaraia",code:1,userInfo:[NSLocalizedDescriptionKey:"Application data directory cannot be a symbolic link."]) }
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:dataDirectory.path)
   lockDescriptor=Darwin.open(dataDirectory.appendingPathComponent("desktop.lock").path,O_CREAT|O_RDWR|O_NOFOLLOW,0o600)
   guard lockDescriptor>=0 else {throw NSError(domain:"Odaraia",code:2,userInfo:[NSLocalizedDescriptionKey:"The private application data directory is unavailable."])}
   guard flock(lockDescriptor,LOCK_EX|LOCK_NB)==0 else {
    NSRunningApplication.runningApplications(withBundleIdentifier:product.bundleIdentifier).first(where:{$0.processIdentifier != ProcessInfo.processInfo.processIdentifier})?.activate(options:[])
    record("ALREADY_RUNNING");NSApp.terminate(nil);return
   }
   makeMenus()
   let setup=ODAStartupRun { self.makeWindow() }
   guard setup["ok"] as? Bool == true else{startupFailure=setup["code"] as? String ?? "NATIVE_SETUP_EXCEPTION";record("NATIVE_SETUP_FAILED",startupFailure);makeEmergencyWindow();showError("The native workspace could not be initialized.",detail:"Quit and reopen this build. Startup diagnostics identify the failed native layout stage.");return}
   setTheme(theme);applyMaterial();startBackend()
   NSWorkspace.shared.notificationCenter.addObserver(self,selector:#selector(accessibilityChanged),name:NSWorkspace.accessibilityDisplayOptionsDidChangeNotification,object:nil)
   appearanceObserver=window.observe(\.effectiveAppearance,options:[.new]){[weak self] _,_ in DispatchQueue.main.async{self?.applyMaterial();self?.emitAppearance()}}
  } catch { record("STARTUP_FAILED","DATA_DIRECTORY_UNAVAILABLE");showError("plainbalance couldn’t open its data folder.",detail:error.localizedDescription) }
 }
 func label(_ text:String,size:CGFloat=12,weight:NSFont.Weight = .regular)->NSTextField{
  let view=NSTextField(labelWithString:text);view.font=NSFont.systemFont(ofSize:size,weight:weight);view.textColor = .labelColor;return view
 }
 func makeWindow(){
  window=NSWindow(contentRect:NSRect(x:0,y:0,width:1320,height:860),styleMask:[.titled,.closable,.miniaturizable,.resizable,.fullSizeContentView],backing:.buffered,defer:false)
  window.title=product.name;window.titleVisibility = .hidden;window.titlebarAppearsTransparent=true;window.isReleasedWhenClosed=false;window.delegate=self;window.minSize=NSSize(width:960,height:650)
  let frameName=testDirectory.map{"OdaraiaReviewWindow-"+$0.lastPathComponent} ?? "OdaraiaMainWindow";window.setFrameAutosaveName(frameName);if !window.setFrameUsingName(frameName){window.center()}
  window.contentView=shellRoot;stage("NATIVE_WINDOW_CREATED")
  assembleNativeChrome()
  appearancePopover.delegate=self
  escapeMonitor=NSEvent.addLocalMonitorForEvents(matching:.keyDown){[weak self] event in guard let self=self,self.appearancePopover.isShown,event.keyCode==53 else{return event};self.dismissAppearance(restoreFocus:true);return nil}
  captureSidebarTextColors(sidebar);applySidebar(animated:false);shellRoot.layoutSubtreeIfNeeded();stage("NATIVE_LAYOUT_READY");updateNavigation("dashboard");window.makeKeyAndOrderFront(nil);NSApp.activate(ignoringOtherApps:true);record("WINDOW_CREATED")
 }
 func initializeWebView(){
  guard web==nil else{return}
  let configuration=WKWebViewConfiguration();configuration.websiteDataStore = .nonPersistent();configuration.preferences.javaScriptCanOpenWindowsAutomatically=false
  desktopGlass.configure(configuration)
  let bridge=WKUserContentController();bridge.add(self,name:"odaraia");configuration.userContentController=bridge
  web=WKWebView(frame:.zero,configuration:configuration);web.wantsLayer=true;web.navigationDelegate=self;web.uiDelegate=self;web.translatesAutoresizingMaskIntoConstraints=false;webHost.addSubview(web)
  stage("WKWEBVIEW_CREATED")
  // Edge-to-edge viewport. Page padding belongs to the document, not a second window frame.
  NSLayoutConstraint.activate([web.leadingAnchor.constraint(equalTo:webHost.leadingAnchor),web.trailingAnchor.constraint(equalTo:webHost.trailingAnchor),web.topAnchor.constraint(equalTo:webHost.topAnchor),web.bottomAnchor.constraint(equalTo:webHost.bottomAnchor)])
  shellRoot.layoutSubtreeIfNeeded()
 }
 func assembleNativeChrome(){
  let root=shellRoot
  backdrop.translatesAutoresizingMaskIntoConstraints=false;root.addSubview(backdrop)
  NSLayoutConstraint.activate([backdrop.leadingAnchor.constraint(equalTo:root.leadingAnchor),backdrop.trailingAnchor.constraint(equalTo:root.trailingAnchor),backdrop.topAnchor.constraint(equalTo:root.topAnchor),backdrop.bottomAnchor.constraint(equalTo:root.bottomAnchor)])
  for view in [sidebar,toolbarMaterial]{view.translatesAutoresizingMaskIntoConstraints=false;root.addSubview(view)}
  let toolbar=ToolbarView();toolbar.translatesAutoresizingMaskIntoConstraints=false;root.addSubview(toolbar)
  sidebar.wantsLayer=true;sidebar.layer?.masksToBounds=true
  sidebarWidth=sidebar.widthAnchor.constraint(equalToConstant:sidebarCollapsed ? 64:240)
  NSLayoutConstraint.activate([sidebar.leadingAnchor.constraint(equalTo:root.leadingAnchor),sidebar.topAnchor.constraint(equalTo:root.topAnchor),sidebar.bottomAnchor.constraint(equalTo:root.bottomAnchor),sidebarWidth,toolbarMaterial.leadingAnchor.constraint(equalTo:root.leadingAnchor),toolbarMaterial.topAnchor.constraint(equalTo:root.topAnchor),toolbarMaterial.trailingAnchor.constraint(equalTo:root.trailingAnchor),toolbarMaterial.heightAnchor.constraint(equalToConstant:64),toolbar.leadingAnchor.constraint(equalTo:toolbarMaterial.leadingAnchor),toolbar.trailingAnchor.constraint(equalTo:toolbarMaterial.trailingAnchor),toolbar.topAnchor.constraint(equalTo:toolbarMaterial.topAnchor),toolbar.bottomAnchor.constraint(equalTo:toolbarMaterial.bottomAnchor)])
  let stack=TopAnchoredStack();navStack=stack;stack.orientation = .vertical;stack.alignment = .leading;stack.spacing=4;stack.translatesAutoresizingMaskIntoConstraints=false;sidebar.addSubview(stack)
  let branding=NSStackView();nativeBrand=branding;branding.orientation = .horizontal;branding.spacing=10
  let icon=NSImageView();icon.image=NSImage(contentsOf:resourceRoot.appendingPathComponent("product-icon.png"));icon.imageScaling = .scaleProportionallyUpOrDown;icon.widthAnchor.constraint(equalToConstant:38).isActive=true;icon.heightAnchor.constraint(equalToConstant:38).isActive=true
  let publisher=label("by "+product.publisher,size:11);publisher.textColor = .secondaryLabelColor
  let copy=NSStackView(views:[label(product.name,size:20,weight:.semibold),publisher]);brandCopy=copy;copy.orientation = .vertical;copy.alignment = .leading;copy.spacing=3;branding.addArrangedSubview(icon);branding.addArrangedSubview(copy);stack.addArrangedSubview(branding);stack.setCustomSpacing(22,after:branding)
  let groups=[("FINANCES",["dashboard","accounts"]),("INSIGHTS",["cashflow","spending","networth","budgets"]),("ACTIVITY",["transactions","import"])]
  func button(_ page:String)->SidebarButton{
   let destination=destinations.first(where:{$0.0==page})!;let button=SidebarButton(title:"  "+destination.1,target:self,action:#selector(navigateButton));button.identifier=NSUserInterfaceItemIdentifier(page);button.bezelStyle = .inline;button.isBordered=false;button.alignment = .left;button.font = .systemFont(ofSize:13,weight:.medium);button.image=NSImage(systemSymbolName:destination.2,accessibilityDescription:nil);button.imagePosition = .imageLeading;button.imageHugsTitle=false;button.contentTintColor = .labelColor;button.heightAnchor.constraint(equalToConstant:36).isActive=true;let width=button.widthAnchor.constraint(equalTo:sidebar.widthAnchor,constant:-32);navigationWidths.append(width);button.toolTip=destination.1;button.setAccessibilityLabel(destination.1);button.motionDisabled={[weak self] in self?.reducedMotion ?? true};navigation.append(button);return button
  }
  for (title,pages) in groups {
   let heading=label(title,size:9,weight:.semibold);sidebarHeadings.append(heading);heading.textColor = .tertiaryLabelColor;stack.addArrangedSubview(heading);stack.setCustomSpacing(8,after:heading)
   for page in pages{stack.addArrangedSubview(button(page))};if let last=stack.arrangedSubviews.last{stack.setCustomSpacing(19,after:last)}
  }
  // One navigation tree, with a native scroll region so short windows keep
  // Settings accessible instead of overlapping the last navigation rows.
  stack.removeFromSuperview();navScroll=NSScrollView();navScroll.contentView=TopAnchoredClip();navScroll.drawsBackground=false;navScroll.contentView.drawsBackground=false;navScroll.hasVerticalScroller=true;navScroll.scrollerStyle = .overlay;navScroll.autohidesScrollers=true;navScroll.translatesAutoresizingMaskIntoConstraints=false;sidebar.addSubview(navScroll);navScroll.documentView=stack
  let navLeading=navScroll.leadingAnchor.constraint(equalTo:sidebar.leadingAnchor,constant:16),navTrailing=navScroll.trailingAnchor.constraint(equalTo:sidebar.trailingAnchor,constant:-16);sidebarMargins=[navLeading,navTrailing]
  NSLayoutConstraint.activate([navLeading,navTrailing,navScroll.topAnchor.constraint(equalTo:sidebar.topAnchor,constant:64),stack.leadingAnchor.constraint(equalTo:navScroll.contentView.leadingAnchor),stack.trailingAnchor.constraint(equalTo:navScroll.contentView.trailingAnchor),stack.topAnchor.constraint(equalTo:navScroll.contentView.topAnchor)])
  let settingsButton=button("settings");settingsButton.translatesAutoresizingMaskIntoConstraints=false;sidebar.addSubview(settingsButton)
  let local=label("PRIVATE · ON THIS MAC",size:9,weight:.medium);sidebarFooter=local;local.textColor = .tertiaryLabelColor;local.translatesAutoresizingMaskIntoConstraints=false;sidebar.addSubview(local)
  let settingsLeading=settingsButton.leadingAnchor.constraint(equalTo:sidebar.leadingAnchor,constant:16);sidebarMargins.append(settingsLeading)
  NSLayoutConstraint.activate([settingsLeading,settingsButton.bottomAnchor.constraint(equalTo:sidebar.bottomAnchor,constant:-44),local.leadingAnchor.constraint(equalTo:sidebar.leadingAnchor,constant:24),local.bottomAnchor.constraint(equalTo:sidebar.bottomAnchor,constant:-20),navScroll.bottomAnchor.constraint(equalTo:settingsButton.topAnchor,constant:-16)])
  sidebarToggle=NSButton(image:NSImage(systemSymbolName:"sidebar.left",accessibilityDescription:"Toggle Sidebar")!,target:self,action:#selector(toggleSidebar));sidebarToggle.isBordered=false;sidebarToggle.translatesAutoresizingMaskIntoConstraints=false;toolbar.addSubview(sidebarToggle)
  NSLayoutConstraint.activate([sidebarToggle.leadingAnchor.constraint(equalTo:toolbar.leadingAnchor,constant:84),sidebarToggle.centerYAnchor.constraint(equalTo:toolbar.centerYAnchor,constant:10),sidebarToggle.widthAnchor.constraint(equalToConstant:30),sidebarToggle.heightAnchor.constraint(equalToConstant:30)])
  toolbarLabel=label("",size:13,weight:.semibold);toolbarLabel.isHidden=true;toolbarLabel.translatesAutoresizingMaskIntoConstraints=false;toolbar.addSubview(toolbarLabel)
  nativeSearch.placeholderString="Search transactions";nativeSearch.font = .systemFont(ofSize:12);nativeSearch.target=self;nativeSearch.action=#selector(runNativeSearch);nativeSearch.sendsSearchStringImmediately=false;nativeSearch.sendsWholeSearchString=true;nativeSearch.translatesAutoresizingMaskIntoConstraints=false;nativeSearch.setAccessibilityLabel("Search all transactions");toolbar.addSubview(nativeSearch)
  let appearance=NSButton(image:NSImage(systemSymbolName:"circle.lefthalf.filled",accessibilityDescription:"Appearance")!,target:self,action:#selector(showAppearance));appearance.isBordered=false;appearance.translatesAutoresizingMaskIntoConstraints=false;appearance.toolTip="Window appearance";appearanceAnchor=appearance;toolbar.addSubview(appearance)
  let add=NSButton(image:NSImage(systemSymbolName:"plus",accessibilityDescription:"New transaction")!,target:self,action:#selector(addTransaction));add.isBordered=false;add.translatesAutoresizingMaskIntoConstraints=false;add.toolTip="New entry (⌘N)";toolbar.addSubview(add)
  NSLayoutConstraint.activate([toolbarLabel.leadingAnchor.constraint(equalTo:toolbar.leadingAnchor,constant:28),toolbarLabel.centerYAnchor.constraint(equalTo:toolbar.centerYAnchor,constant:10),add.trailingAnchor.constraint(equalTo:toolbar.trailingAnchor,constant:-24),add.centerYAnchor.constraint(equalTo:toolbarLabel.centerYAnchor),add.widthAnchor.constraint(equalToConstant:30),add.heightAnchor.constraint(equalToConstant:30),appearance.trailingAnchor.constraint(equalTo:add.leadingAnchor,constant:-12),appearance.centerYAnchor.constraint(equalTo:toolbarLabel.centerYAnchor),appearance.widthAnchor.constraint(equalToConstant:30),appearance.heightAnchor.constraint(equalToConstant:30),nativeSearch.trailingAnchor.constraint(equalTo:appearance.leadingAnchor,constant:-18),nativeSearch.centerYAnchor.constraint(equalTo:toolbarLabel.centerYAnchor),nativeSearch.widthAnchor.constraint(equalToConstant:230)])
  // All nine buttons now belong to sidebar (including the scroll document).
  // Activating a button/sidebar constraint inside button() throws in AppKit.
  NSLayoutConstraint.activate(navigationWidths)
  stage("NATIVE_CHROME_ATTACHED")
  webHost.translatesAutoresizingMaskIntoConstraints=false;root.addSubview(webHost)
  NSLayoutConstraint.activate([webHost.leadingAnchor.constraint(equalTo:sidebar.trailingAnchor),webHost.trailingAnchor.constraint(equalTo:root.trailingAnchor),webHost.topAnchor.constraint(equalTo:toolbar.bottomAnchor),webHost.bottomAnchor.constraint(equalTo:root.bottomAnchor)])
  loadingView.wantsLayer=true;loadingView.translatesAutoresizingMaskIntoConstraints=false;root.addSubview(loadingView)
  NSLayoutConstraint.activate([loadingView.leadingAnchor.constraint(equalTo:webHost.leadingAnchor),loadingView.trailingAnchor.constraint(equalTo:webHost.trailingAnchor),loadingView.topAnchor.constraint(equalTo:webHost.topAnchor),loadingView.bottomAnchor.constraint(equalTo:webHost.bottomAnchor)])
  let status=NSStackView();status.orientation = .vertical;status.alignment = .centerX;status.spacing=14;status.translatesAutoresizingMaskIntoConstraints=false;loadingView.addSubview(status)
  statusTitle=label("Opening your finances…",size:19,weight:.semibold);statusDetail=NSTextField(wrappingLabelWithString:"Starting the packaged local service.");statusDetail.font = .systemFont(ofSize:13);statusDetail.alignment = .center
  retryButton=NSButton(title:"Retry loading workspace",target:self,action:#selector(retryWorkspace));retryButton.bezelStyle = .rounded;retryButton.isHidden=true
  for view in [statusTitle!,statusDetail!,retryButton!]{status.addArrangedSubview(view)}
  NSLayoutConstraint.activate([status.centerXAnchor.constraint(equalTo:loadingView.centerXAnchor),status.centerYAnchor.constraint(equalTo:loadingView.centerYAnchor),status.widthAnchor.constraint(lessThanOrEqualTo:loadingView.widthAnchor,constant:-48),statusDetail.widthAnchor.constraint(lessThanOrEqualToConstant:500)])
 }
 func makeEmergencyWindow(){
  // A setup exception is terminal for this hierarchy. Never continue startup
  // or offer a reload using its partially initialized controls.
  statusTitle=nil;statusDetail=nil;retryButton=nil
  if window==nil{window=NSWindow(contentRect:NSRect(x:0,y:0,width:900,height:650),styleMask:[.titled,.closable,.resizable],backing:.buffered,defer:false);window.isReleasedWhenClosed=false;window.delegate=self}
  let view=NSView(frame:NSRect(x:0,y:0,width:900,height:650));view.wantsLayer=true;view.layer?.backgroundColor=NSColor.windowBackgroundColor.cgColor;window.contentView=view
  let title=label("plainbalance by Talarurus — workspace startup failed",size:17,weight:.semibold);title.frame=NSRect(x:40,y:300,width:800,height:40);view.addSubview(title);window.makeKeyAndOrderFront(nil)
 }
 @objc func showAppearance(_ sender:NSButton){
  if appearancePopover.isShown{dismissAppearance(restoreFocus:true);return}
  appearanceSegments.removeAll();let controller=NSViewController();let effect=NSVisualEffectView();effect.material = .popover;effect.blendingMode = .withinWindow;effect.state = .active;controller.view=effect
  let stack=NSStackView();stack.orientation = .vertical;stack.alignment = .leading;stack.spacing=10;stack.translatesAutoresizingMaskIntoConstraints=false;effect.addSubview(stack)
  stack.addArrangedSubview(label("Appearance",size:15,weight:.semibold))
  for (key,title,labels) in [("theme","Theme",["System","Light","Dark"]),("window","Window appearance",["Solid","Glass"])]{
   stack.addArrangedSubview(label(title,size:11,weight:.medium));let control=NSSegmentedControl(labels:labels,trackingMode:.selectOne,target:self,action:#selector(changeAppearanceSegment));control.identifier=NSUserInterfaceItemIdentifier(key);control.widthAnchor.constraint(equalToConstant:272).isActive=true;control.setAccessibilityLabel(title);appearanceSegments[key]=control;stack.addArrangedSubview(control)
  }
  let row=NSStackView();row.orientation = .horizontal;row.spacing=12;row.addArrangedSubview(label("Glass intensity",size:11,weight:.medium));let value=label("",size:11);value.textColor = .secondaryLabelColor;appearanceValue=value;row.addArrangedSubview(value);stack.addArrangedSubview(row)
  let slider=NSSlider(value:0,minValue:0,maxValue:1,target:self,action:#selector(changeAppearanceSlider));slider.isContinuous=true;slider.widthAnchor.constraint(equalToConstant:272).isActive=true;slider.setAccessibilityLabel("Glass intensity");appearanceSlider=slider;stack.addArrangedSubview(slider)
  let note=label(desktopGlass.available ? "Experimental native tint · fixed private blur 64.":"Solid fallback · experimental glass not enabled.",size:10);note.textColor = .secondaryLabelColor;stack.addArrangedSubview(note)
  let settings=NSButton(title:"Appearance settings…",target:self,action:#selector(self.settings));settings.bezelStyle = .inline;stack.addArrangedSubview(settings)
  NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo:effect.leadingAnchor,constant:18),stack.trailingAnchor.constraint(equalTo:effect.trailingAnchor,constant:-18),stack.topAnchor.constraint(equalTo:effect.topAnchor,constant:18),stack.bottomAnchor.constraint(equalTo:effect.bottomAnchor,constant:-18)])
  restorePopoverFocus=false;appearancePopover.contentViewController=controller;appearancePopover.behavior = .transient;appearancePopover.animates = !reducedMotion;appearancePopover.contentSize=NSSize(width:308,height:300);syncAppearanceControls();appearancePopover.show(relativeTo:sender.bounds,of:sender,preferredEdge:.minY)
 }
 func dismissAppearance(restoreFocus:Bool=false){restorePopoverFocus=restoreFocus;appearancePopover.performClose(nil)}
 func popoverDidClose(_ notification:Notification){if restorePopoverFocus,let button=appearanceAnchor{window.makeFirstResponder(button)};restorePopoverFocus=false;appearanceSlider=nil;appearanceValue=nil;appearanceSegments.removeAll()}
 func syncAppearanceControls(){
  appearanceSegments["theme"]?.selectedSegment=["system","light","dark"].firstIndex(of:theme) ?? 0
  appearanceSegments["window"]?.selectedSegment=effectiveWindow=="solid" ? 0:1
  appearanceSegments["window"]?.setEnabled(desktopGlass.available,forSegment:1)
  appearanceSlider?.doubleValue=GlassPreferences(material).glass;appearanceSlider?.isEnabled=effectiveWindow=="translucent"
  appearanceValue?.stringValue=String(Int(GlassPreferences(material).glass*100))+"%"
 }
 @objc func changeAppearanceSegment(_ sender:NSSegmentedControl){
  guard sender.selectedSegment>=0 else{return}
  if sender.identifier?.rawValue=="theme"{setTheme(["system","light","dark"][sender.selectedSegment])}
  else if sender.identifier?.rawValue=="window"{let value=["solid","translucent"][sender.selectedSegment];guard value=="solid" || desktopGlass.available else{return};startupSolidOverride=false;defaults.set(value,forKey:"talarurus.windowAppearance");applyMaterial()}
  emitAppearance()
 }
 @objc func changeAppearanceSlider(_ sender:NSSlider){guard effectiveWindow=="translucent" else{return};defaults.set(GlassPreferences(["glass":sender.doubleValue]).dictionary,forKey:"talarurus.material");applyMaterial();emitAppearance()}
 func bootstrapScript()->String{
  let state:[String:Any]=["windowAppearance":requestedWindow,"effectiveWindowAppearance":effectiveWindow,"translucencyAvailable":desktopGlass.available,"compositingMode":desktopGlass.active ? "native-desktop-glass":"solid","glassDiagnostics":desktopGlass.diagnostics,"sidebarCollapsed":sidebarCollapsed,"theme":theme,"material":material,"reduceTransparency":reducedTransparency,"reduceMotion":reducedMotion]
  let json=String(data:try! JSONSerialization.data(withJSONObject:state),encoding:.utf8)!
  let presentation=defaults.dictionary(forKey:"talarurus.presentation") ?? ["hidden":false,"format":"symbol","reduceMotion":false]
  let pjson=String(data:(try? JSONSerialization.data(withJSONObject:presentation)) ?? Data("{}".utf8),encoding:.utf8)!
  return "window.__ODARAIA_NATIVE__=\(json);document.documentElement.dataset.native='true';document.documentElement.dataset.windowStyle=window.__ODARAIA_NATIVE__.effectiveWindowAppearance;document.documentElement.dataset.compositingMode=window.__ODARAIA_NATIVE__.compositingMode;document.documentElement.dataset.sidebar=window.__ODARAIA_NATIVE__.sidebarCollapsed?'collapsed':'expanded';try{localStorage.setItem('talarurus.material',JSON.stringify(window.__ODARAIA_NATIVE__.material));localStorage.setItem('talarurus.appearance',window.__ODARAIA_NATIVE__.theme);localStorage.setItem('talarurus.windowAppearance',window.__ODARAIA_NATIVE__.windowAppearance);localStorage.setItem('talarurus.presentation',JSON.stringify(\(pjson)));}catch{}"
 }
 func startBackend(){
  guard child==nil else{return}
  ready=false;origin=nil;stdoutBuffer.removeAll();backendErrorCode="";startupTimer?.invalidate();workspaceTimer?.invalidate()
  for (file,code) in [("runtime/node","RUNTIME_MISSING"),("backend/desktop/backend.mjs","BACKEND_ENTRY_MISSING"),("backend/dist/index.html","HTML_MISSING"),("backend/dist/app.js","SCRIPT_MISSING"),("backend/dist/app.css","STYLE_MISSING"),("backend/dist/appearance.js","BOOTSTRAP_MISSING")] {
   guard FileManager.default.fileExists(atPath:resourceRoot.appendingPathComponent(file).path) else{failStartup(code,"A packaged application resource is missing. Rebuild this app; your database has not been changed.");return}
  }
  stage("PACKAGED_RESOURCES_VALIDATED")
  var bytes=[UInt8](repeating:0,count:32);guard SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)==errSecSuccess else{failStartup("SESSION_RANDOM_FAILED","plainbalance could not create a private local session. Retry startup.");return}
  launchToken=bytes.map{String(format:"%02x",$0)}.joined()
  let process=Process(),stdin=Pipe(),stdout=Pipe(),stderr=Pipe();child=process;input=stdin;output=stdout;errorPipe=stderr
  process.executableURL=resourceRoot.appendingPathComponent("runtime/node");process.arguments=[resourceRoot.appendingPathComponent("backend/desktop/backend.mjs").path]
  process.currentDirectoryURL=resourceRoot.appendingPathComponent("backend")
  var env=["PATH":"/usr/bin:/bin","HOME":NSHomeDirectory(),"ODARAIA_DESKTOP_TOKEN":launchToken,"ODARAIA_PARENT_PID":String(ProcessInfo.processInfo.processIdentifier)]
  // The host owns the data-directory lock. Both launch paths pass that exact
  // directory to the unchanged backend (the legacy override key is private).
  env["ODARAIA_TEST_SUPPORT"]=dataDirectory.path
  process.environment=env;process.standardInput=stdin;process.standardOutput=stdout;process.standardError=stderr
  // stderr is consumed but never displayed or written with financial records.
  stderr.fileHandleForReading.readabilityHandler={[weak self] handle in
   let bytes=handle.availableData
   // Match only the backend's fixed public error-code line. Drop all raw stderr.
   guard let text=String(data:bytes,encoding:.utf8) else{return}
   let codes=["EPERM","EACCES","EADDRINUSE","EADDRNOTAVAIL","ENOENT","ENOSPC","SQLITE_CANTOPEN","SQLITE_CORRUPT"]
   if let code=codes.first(where:{text.contains("plainbalance backend could not start: "+$0+".")}){DispatchQueue.main.async{self?.backendErrorCode=code;self?.record("BACKEND_ERROR_CODE",code)}}
  }
  stdout.fileHandleForReading.readabilityHandler={[weak self] handle in let data=handle.availableData;if data.isEmpty{return};DispatchQueue.main.async{self?.received(data)}}
  process.terminationHandler={[weak self] process in DispatchQueue.main.async{guard let self=self else{return};self.startupTimer?.invalidate();self.output?.fileHandleForReading.readabilityHandler=nil;self.errorPipe?.fileHandleForReading.readabilityHandler=nil;self.child=nil;self.ready=false;self.workspaceReady=false;self.workspaceVerified=false;if self.terminating{self.finishTermination()}else{self.record("BACKEND_EXITED","Exit \(process.terminationStatus); code=\(self.backendErrorCode.isEmpty ? "UNAVAILABLE":self.backendErrorCode)");self.failStartup("BACKEND_EXITED","The local finance service stopped. Retry to restart it, or quit and reopen plainbalance. Your saved database has not been deleted.")}}}
  do{try process.run();stage("BACKEND_SPAWNED");startupTimer=Timer.scheduledTimer(withTimeInterval:20,repeats:false){[weak self] _ in guard let self=self,!self.ready else{return};self.record("BACKEND_TIMEOUT");self.failStartup("BACKEND_TIMEOUT","The bundled service did not become ready. Retry to restart it. Your database has not been deleted.");self.child?.terminate()}}
  catch{child=nil;record("BACKEND_LAUNCH_FAILED","PROCESS_LAUNCH_REJECTED");failStartup("BACKEND_LAUNCH_FAILED","The bundled finance service could not launch. Retry, or rebuild the app with a runtime compatible with this Mac.")}
 }
 func received(_ data:Data){
  guard !ready else{return};stdoutBuffer.append(data);guard stdoutBuffer.count<4096 else{failStartup("BACKEND_PROTOCOL_OVERSIZE","The local service returned an invalid readiness message.");child?.terminate();return}
  guard let end=stdoutBuffer.firstIndex(of:10) else{return}
  guard let value=try? JSONSerialization.jsonObject(with:stdoutBuffer.prefix(upTo:end)) as? [String:Any],value["type"] as? String=="ready",let pid=value["pid"] as? Int,pid==Int(child?.processIdentifier ?? 0),let text=value["origin"] as? String,let url=URL(string:text),url.scheme=="http",url.host=="127.0.0.1",let port=url.port,port>0 else{failStartup("BACKEND_PROTOCOL_INVALID","The finance service returned an invalid readiness message. Retry startup.");child?.terminate();return}
  origin=url;ready=true;startupTimer?.invalidate();stage("BACKEND_READY")
  let setup=ODAStartupRun { self.initializeWebView() }
  guard setup["ok"] as? Bool == true else{failStartup(setup["code"] as? String ?? "WEBKIT_SETUP_EXCEPTION","WebKit could not initialize. Quit and reopen this build.");retryButton.isHidden=true;child?.terminate();return}
  applyMaterial()
  installSessionAndNavigate()
 }
 func installSessionAndNavigate(){
  guard ready,let origin=origin,web != nil else{return}
  workspaceAttempt+=1;let attempt=workspaceAttempt
  web.configuration.userContentController.removeAllUserScripts();web.configuration.userContentController.addUserScript(WKUserScript(source:bootstrapScript()+startupDiagnosticScript(),injectionTime:.atDocumentStart,forMainFrameOnly:true))
  func navigate(){self.navigationCompleted=false;self.stage("INITIAL_NAVIGATION_REQUESTED");self.beginWorkspaceDeadline();self.web.load(URLRequest(url:origin))}
  if launchToken.isEmpty{navigate();return}
  let cookie=HTTPCookie(properties:[.domain:"127.0.0.1",.path:"/",.name:"odaraia-local-access",.value:launchToken,HTTPCookiePropertyKey("HttpOnly"):"TRUE",HTTPCookiePropertyKey("SameSite"):"Strict"])!
  stage("SESSION_COOKIE_INSTALL_STARTED");beginWorkspaceDeadline()
  let store=web.configuration.websiteDataStore.httpCookieStore
  store.setCookie(cookie){[weak self] in
   store.getAllCookies{cookies in DispatchQueue.main.async{
    guard let self=self,!self.terminating,self.workspaceAttempt==attempt else{return}
    guard cookies.contains(where:{$0.name=="odaraia-local-access" && $0.value==self.launchToken && $0.isHTTPOnly}) else{self.failStartup("SESSION_COOKIE_FAILED","The private local session could not be stored. Retry loading the workspace.");return}
    self.launchToken="";self.stage("SESSION_COOKIE_STORED");navigate()
   }}
  }

 }
 func updateNavigation(_ page:String){guard let destination=destinations.first(where:{$0.0==page}) else{return};if currentPage != page{dismissAppearance()};currentPage=page;record("PAGE_CHANGED",page);toolbarLabel.stringValue="";for button in navigation{button.selected=button.identifier?.rawValue==page}}
 @objc func navigateButton(_ button:NSButton){if let page=button.identifier?.rawValue{command("navigate",page)}}
 func command(_ type:String,_ value:String=""){if ["navigate","search","add"].contains(type){dismissAppearance()};let json=String(data:try! JSONSerialization.data(withJSONObject:["type":type,"value":value]),encoding:.utf8)!;web?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('odaraia-command',{detail:\(json)}));",completionHandler:nil)}
 @objc func searchTransactions(){window.makeFirstResponder(nativeSearch)}
 @objc func runNativeSearch(){command("search",nativeSearch.stringValue)}
 @objc func addTransaction(){command("add")}
 @objc func settings(){command("navigate","settings")}
 @objc func toggleSidebar(){
  defaults.set(!sidebarCollapsed,forKey:"odaraia.sidebarCollapsed");dismissAppearance();applySidebar(animated:true)
 }
 func applySidebar(animated:Bool,collapsedOverride:Bool?=nil){
  let started=ProcessInfo.processInfo.systemUptime,collapsed=collapsedOverride ?? sidebarCollapsed
  brandCopy.isHidden=collapsed;sidebarFooter.isHidden=collapsed;for heading in sidebarHeadings{heading.isHidden=collapsed}
  for button in navigation{let destination=destinations.first(where:{$0.0==button.identifier?.rawValue})!;button.title=collapsed ? "":"  "+destination.1;button.imagePosition=collapsed ? .imageOnly:.imageLeading;button.alignment=collapsed ? .center:.left}
  sidebarToggle.toolTip=(collapsed ? "Expand":"Collapse")+" sidebar (⌘B)";sidebarToggle.setAccessibilityLabel(collapsed ? "Expand Sidebar":"Collapse Sidebar");sidebarToggle.setAccessibilityValue(collapsed ? "Collapsed":"Expanded");sidebarMenuItem?.state=collapsed ? .off:.on
  let layout={self.sidebarWidth.constant=collapsed ? 64:240;for (index,margin) in self.sidebarMargins.enumerated(){margin.constant=index==1 ? (collapsed ? -10:-16):(collapsed ? 10:16)};for width in self.navigationWidths{width.constant=collapsed ? -20:-32};self.shellRoot.layoutSubtreeIfNeeded()}
  let duration=animated && !reducedMotion ? 0.18:0
  NSAnimationContext.runAnimationGroup({context in context.duration=duration;context.allowsImplicitAnimation=duration>0;context.timingFunction=CAMediaTimingFunction(name:.easeInEaseOut);layout()},completionHandler:{[weak self] in
   guard let self=self else{return};self.record("SIDEBAR_TRANSITION_FINISHED","configuredDuration=\(duration); elapsed=\(ProcessInfo.processInfo.systemUptime-started); viewport=\(self.web?.bounds.width ?? 0)")
  })
  let state:[String:Any]=["sidebarCollapsed":collapsed,"sidebarWidth":collapsed ? 64:240]
  let json=String(data:try! JSONSerialization.data(withJSONObject:state),encoding:.utf8)!
  web?.evaluateJavaScript("Object.assign(window.__ODARAIA_NATIVE__||{},\(json));document.documentElement.dataset.sidebar=\(collapsed ? "'collapsed'":"'expanded'");window.dispatchEvent(new CustomEvent('odaraia-layout',{detail:\(json)}));",completionHandler:nil)
 }
 @objc func about(){
  let panel=NSPanel(contentRect:NSRect(x:0,y:0,width:420,height:360),styleMask:[.titled,.closable],backing:.buffered,defer:false);panel.title="About "+product.name;panel.isReleasedWhenClosed=false
  let stack=NSStackView();stack.orientation = .vertical;stack.alignment = .centerX;stack.spacing=14;stack.translatesAutoresizingMaskIntoConstraints=false;panel.contentView?.addSubview(stack)
  let icon=NSImageView();icon.image=NSImage(contentsOf:resourceRoot.appendingPathComponent("product-icon.png"));icon.imageScaling = .scaleProportionallyUpOrDown;icon.widthAnchor.constraint(equalToConstant:64).isActive=true;icon.heightAnchor.constraint(equalToConstant:64).isActive=true
  stack.addArrangedSubview(icon);stack.addArrangedSubview(label(product.name,size:28,weight:.semibold));stack.addArrangedSubview(label("Version "+product.version,size:11));stack.addArrangedSubview(label("by "+product.publisher,size:13,weight:.medium))
  let dark=window.effectiveAppearance.bestMatch(from:[.aqua,.darkAqua]) == .darkAqua
  let publisher=NSImageView();publisher.image=NSImage(contentsOf:resourceRoot.appendingPathComponent("backend/dist/assets/brand/publisher/talarurus-horizontal"+(dark ? "-white":"")+".svg"));publisher.imageScaling = .scaleProportionallyUpOrDown;publisher.widthAnchor.constraint(equalToConstant:116).isActive=true;publisher.heightAnchor.constraint(equalToConstant:28).isActive=true;publisher.setAccessibilityLabel(product.publisher);stack.addArrangedSubview(publisher)
  stack.addArrangedSubview(label("Local-first personal finance",size:11));stack.addArrangedSubview(label("Working identity · founder review",size:10))
  NSLayoutConstraint.activate([stack.centerXAnchor.constraint(equalTo:panel.contentView!.centerXAnchor),stack.centerYAnchor.constraint(equalTo:panel.contentView!.centerYAnchor)]);window.beginSheet(panel,completionHandler:nil)
  panel.standardWindowButton(.closeButton)?.target=self;panel.standardWindowButton(.closeButton)?.action=#selector(closeAbout)
 }
 @objc func closeAbout(_ button:NSButton){if let sheet=button.window{window.endSheet(sheet);sheet.orderOut(nil)}}
 func setTheme(_ value:String){guard ["system","light","dark"].contains(value) else{return};defaults.set(value,forKey:"talarurus.appearance");NSApp.appearance=value=="system" ? nil:NSAppearance(named:value=="dark" ? .darkAqua:.aqua);applyMaterial()}
 func captureSidebarTextColors(_ view:NSView){
  if let field=view as? NSTextField{sidebarTextColors.append((field,field.textColor ?? .labelColor))};for child in view.subviews{captureSidebarTextColors(child)}
 }
 func applyMaterial(){
  guard window != nil else{return}
  // The native loading state is present before the backend and WebKit.
  guard web != nil else{window.isOpaque=true;window.backgroundColor = .windowBackgroundColor;loadingView.layer?.backgroundColor=NSColor.windowBackgroundColor.cgColor;return}
  let dark=window.effectiveAppearance.bestMatch(from:[.aqua,.darkAqua]) == .darkAqua
  let started=ProcessInfo.processInfo.systemUptime
  desktopGlass.apply(window:window,web:web,backdrop:backdrop,wantsGlass:requestedWindow=="translucent" && glassPaintReady && !reducedTransparency,dark:dark,preferences:GlassPreferences(material))
  if ProcessInfo.processInfo.systemUptime-lastMaterialLog>=0.25{lastMaterialLog=ProcessInfo.processInfo.systemUptime;record("MATERIAL_CONFIGURED","nativeCallElapsed=\(ProcessInfo.processInfo.systemUptime-started); pixels UNVERIFIED")}
  for (field,color) in sidebarTextColors{field.textColor=desktopGlass.active ? .labelColor:color}
  loadingView.layer?.backgroundColor=NSColor.windowBackgroundColor.cgColor
  appearancePopover.animates = !reducedMotion;syncAppearanceControls()
 }
 @objc func accessibilityChanged(){
  applyMaterial();emitAppearance();let state:[String:Bool]=["reduceTransparency":reducedTransparency,"reduceMotion":reducedMotion]
  let json=String(data:try! JSONSerialization.data(withJSONObject:state),encoding:.utf8)!
  web?.evaluateJavaScript("Object.assign(window.__ODARAIA_NATIVE__||{},\(json));window.dispatchEvent(new CustomEvent('odaraia-accessibility',{detail:\(json)}));",completionHandler:nil)
 }
 func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage){
  guard message.frameInfo.isMainFrame,let expected=origin,let frameURL=message.frameInfo.request.url,frameURL.scheme==expected.scheme,frameURL.host==expected.host,frameURL.port==expected.port,let object=message.body as? [String:Any],let type=object["type"] as? String else{return}
  switch type {
  case "workspaceReady":guard ready,startupFailure.isEmpty else{return};workspaceReady=true;finishWorkspaceStartup()
  case "glassPaintReady":guard workspaceVerified,startupFailure.isEmpty else{return};glassPaintReady=true;applyMaterial();emitAppearance();record("GLASS_PAINT_GATE_REACHED")
  case "startup":
   let allowed=["REACT_RENDER_REQUESTED","REACT_ROOT_MOUNTED","SESSION_REQUESTED","SESSION_ESTABLISHED","SESSION_FAILED","STATE_FETCH_STARTED","STATE_FETCHED","STATE_FETCH_FAILED","WORKSPACE_RENDERED","WORKSPACE_GEOMETRY_INVALID","REACT_RENDER_FAILED","JAVASCRIPT_ERROR","RESOURCE_LOAD_FAILED","UNHANDLED_REJECTION"]
   guard let name=object["stage"] as? String,allowed.contains(name) else{return}
   stage(name)
   if ["SESSION_FAILED","STATE_FETCH_FAILED","WORKSPACE_GEOMETRY_INVALID","REACT_RENDER_FAILED","JAVASCRIPT_ERROR","RESOURCE_LOAD_FAILED","UNHANDLED_REJECTION"].contains(name){
    let codes=["SESSION_HTTP","SESSION_NETWORK","SESSION_RESPONSE","STATE_HTTP","STATE_NETWORK","STATE_RESPONSE","REACT_BOUNDARY"]
    let code=(object["code"] as? String).flatMap{codes.contains($0) ? $0:nil}
    failStartup(code.map{name+":"+$0} ?? name,"The financial workspace could not initialize (\(name)). Retry loading, or quit and reopen. Startup diagnostics contain stage identifiers without financial data.")
   }
  case "page":if let page=object["value"] as? String{updateNavigation(page)}
  case "theme":if let value=object["value"] as? String{setTheme(value);emitAppearance()}
  case "windowAppearance":if let value=object["value"] as? String,["solid","translucent"].contains(value),(value=="solid" || desktopGlass.available){startupSolidOverride=false;defaults.set(value,forKey:"talarurus.windowAppearance");applyMaterial();emitAppearance()}
  case "material":if let value=object["value"] as? [String:Any]{defaults.set(normalizedMaterial(value),forKey:"talarurus.material");applyMaterial();emitAppearance()}
  case "presentation":if let value=object["value"] as? [String:Any],let hidden=value["hidden"] as? Bool,let motion=value["reduceMotion"] as? Bool,let format=value["format"] as? String,["symbol","code"].contains(format){defaults.set(["hidden":hidden,"reduceMotion":motion,"format":format],forKey:"talarurus.presentation");emitAppearance()}
  case "export":if let value=object["value"] as? [String:Any],let filename=value["filename"] as? String,[product.downloads.backup,product.downloads.transactions].contains(filename),let text=value["text"] as? String,text.utf8.count<=16*1024*1024{saveExport(filename,text)}
  default:break
  }
 }
 func saveExport(_ filename:String,_ text:String){
  let panel=NSSavePanel();panel.nameFieldStringValue=filename;panel.canCreateDirectories=true;panel.title="Save private financial file";panel.beginSheetModal(for:window){[weak self] result in guard result == .OK,let url=panel.url else{return};do{try Data(text.utf8).write(to:url,options:.atomic);try FileManager.default.setAttributes([.posixPermissions:0o600],ofItemAtPath:url.path)}catch{self?.showError("The export could not be saved.",detail:error.localizedDescription)}}
 }
 func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){
  guard let url=navigationAction.request.url,let expected=origin,url.scheme==expected.scheme,url.host==expected.host,url.port==expected.port,navigationAction.targetFrame?.isMainFrame==true else{decisionHandler(.cancel);return};decisionHandler(.allow)
 }
 func webView(_ webView:WKWebView,didStartProvisionalNavigation navigation:WKNavigation!){
  startupFailure="";navigationCompleted=false;workspaceReady=false;workspaceVerified=false;glassPaintReady=false;loadingView.isHidden=false;statusTitle.stringValue="Opening your finances…";retryButton.isHidden=true;applyMaterial();beginWorkspaceDeadline();stage("NAVIGATION_STARTED")
 }
 func webView(_ webView:WKWebView,didCommit navigation:WKNavigation!){stage("NAVIGATION_COMMITTED")}
 func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){navigationCompleted=true;stage("NAVIGATION_COMPLETED");record("WEB_LOADED");finishWorkspaceStartup()}
 func webView(_ webView:WKWebView,didFail navigation:WKNavigation!,withError error:Error){navigationFailed(error)}
 func navigationFailed(_ error:Error){let e=error as NSError;guard e.code != NSURLErrorCancelled else{return};record("WEB_LOAD_FAILED","code=\(e.code)");failStartup("NAVIGATION_FAILED","The local page failed to load (code \(e.code)). Retry loading the workspace.")}
 func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error){navigationFailed(error)}
 func webViewWebContentProcessDidTerminate(_ webView:WKWebView){record("WEB_PROCESS_EXITED");failStartup("WEB_PROCESS_EXITED","The workspace process stopped. Retry loading, or quit and reopen. Your local financial records remain saved.")}
 // File selection uses a native open panel; no filesystem API is exposed to JavaScript.
 func webView(_ webView:WKWebView,runOpenPanelWith parameters:WKOpenPanelParameters,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping([URL]?)->Void){let panel=NSOpenPanel();panel.allowsMultipleSelection=false;panel.canChooseDirectories=false;panel.beginSheetModal(for:window){result in completionHandler(result == .OK ? panel.urls:nil)}}
 func startupDiagnosticScript()->String {
  return """
  window.addEventListener('error',event=>{let stage='JAVASCRIPT_ERROR';if(event.target instanceof HTMLScriptElement||event.target instanceof HTMLLinkElement)stage='RESOURCE_LOAD_FAILED';try{window.webkit.messageHandlers.odaraia.postMessage({type:'startup',stage});}catch{}},true);
  window.addEventListener('unhandledrejection',()=>{try{window.webkit.messageHandlers.odaraia.postMessage({type:'startup',stage:'UNHANDLED_REJECTION'});}catch{}});
  """
 }
 func beginWorkspaceDeadline(){workspaceTimer?.invalidate();workspaceTimer=Timer.scheduledTimer(withTimeInterval:25,repeats:false){[weak self] _ in guard let self=self,!self.workspaceReady else{return};self.failStartup("WORKSPACE_TIMEOUT","The workspace did not finish startup. Last stage: \(self.startupStage). Retry loading; saved records remain intact.")}}
 func finishWorkspaceStartup(){
  guard ready,navigationCompleted,workspaceReady,!workspaceVerified,startupFailure.isEmpty else{return}
  shellRoot.layoutSubtreeIfNeeded()
  guard web.bounds.width>100,web.bounds.height>100 else{failStartup("NATIVE_VIEWPORT_INVALID","The web viewport has invalid geometry. Quit and reopen this build.");return}
  workspaceVerified=true;workspaceTimer?.invalidate();loadingView.isHidden=true;stage("WORKSPACE_READY")
  web.evaluateJavaScript("requestAnimationFrame(()=>requestAnimationFrame(()=>window.webkit.messageHandlers.odaraia.postMessage({type:'glassPaintReady'})));",completionHandler:nil)
  if testDirectory != nil,arguments.contains("--smoke-exit"),!smokeExitScheduled{smokeExitScheduled=true;Timer.scheduledTimer(withTimeInterval:3,repeats:false){[weak self] _ in if arguments.contains("--smoke-close"){self?.window.performClose(nil)}else{NSApp.terminate(nil)}}}
 }
 func failStartup(_ code:String,_ message:String){
  // Preserve the first failure; cascading fetch/termination events must not
  // replace the stage that explains why startup stopped.
  guard startupFailure.isEmpty else{return}
  startupFailure=code;workspaceTimer?.invalidate();glassPaintReady=false;workspaceReady=false;workspaceVerified=false;record("STARTUP_FAILED",code);applyMaterial();loadingView.isHidden=false;statusTitle?.stringValue="plainbalance could not load the workspace";statusDetail?.stringValue=message;retryButton?.isHidden=false
 }
 @objc func retryWorkspace(){
  startupFailure="";navigationCompleted=false;workspaceReady=false;workspaceVerified=false;glassPaintReady=false;loadingView.isHidden=false;statusTitle.stringValue="Opening your finances…";retryButton.isHidden=true;applyMaterial();stage("WORKSPACE_RETRY_REQUESTED")
  if let child=child,child.isRunning{if ready{installSessionAndNavigate()}else{statusDetail.stringValue="Waiting for the current local service."}}else{startBackend()}
 }
 func showError(_ title:String,detail:String="") {if statusTitle != nil && !workspaceVerified{failStartup("NATIVE_OPERATION_FAILED",detail.isEmpty ? title:title+" "+detail);return};let alert=NSAlert();alert.messageText=title;alert.informativeText=detail;alert.alertStyle = .warning;alert.addButton(withTitle:"OK");if let window=window,window.isVisible{alert.beginSheetModal(for:window,completionHandler:nil)}else{alert.runModal()}}
 func makeMenus(){
  let bar=NSMenu();NSApp.mainMenu=bar
  func menu(_ title:String)->NSMenu{let item=NSMenuItem();let menu=NSMenu(title:title);item.submenu=menu;bar.addItem(item);return menu}
  func item(_ menu:NSMenu,_ title:String,_ action:Selector?,_ key:String="",_ target:AnyObject?=nil){let i=NSMenuItem(title:title,action:action,keyEquivalent:key);i.target=target;menu.addItem(i)}
  let app=menu(product.name);item(app,"About "+product.name,#selector(about),"",self);app.addItem(.separator());item(app,"Settings…",#selector(settings),",",self);app.addItem(.separator());item(app,"Hide "+product.name,#selector(NSApplication.hide(_:)),"h");item(app,"Hide Others",#selector(NSApplication.hideOtherApplications(_:)),"h");app.items.last?.keyEquivalentModifierMask=[.command,.option];item(app,"Show All",#selector(NSApplication.unhideAllApplications(_:)));app.addItem(.separator());item(app,"Quit "+product.name,#selector(NSApplication.terminate(_:)),"q")
  let file=menu("File");item(file,"New Transaction",#selector(addTransaction),"n",self);item(file,"Close Window",#selector(NSWindow.performClose(_:)),"w")
  let edit=menu("Edit");item(edit,"Undo",Selector(("undo:")),"z");item(edit,"Redo",Selector(("redo:")),"Z");edit.addItem(.separator());item(edit,"Cut",#selector(NSText.cut(_:)),"x");item(edit,"Copy",#selector(NSText.copy(_:)),"c");item(edit,"Paste",#selector(NSText.paste(_:)),"v");item(edit,"Select All",#selector(NSText.selectAll(_:)),"a");edit.addItem(.separator());item(edit,"Find Transactions",#selector(searchTransactions),"f",self)
  let view=menu("View");item(view,"Toggle Sidebar",#selector(toggleSidebar),"b",self);sidebarMenuItem=view.items.last
  let win=menu("Window");NSApp.windowsMenu=win;item(win,"Minimize",#selector(NSWindow.performMiniaturize(_:)),"m");item(win,"Zoom",#selector(NSWindow.performZoom(_:)));item(win,"Bring All to Front",#selector(NSApplication.arrangeInFront(_:)))
 }
 func applicationShouldHandleReopen(_ sender:NSApplication,hasVisibleWindows flag:Bool)->Bool{window?.makeKeyAndOrderFront(nil);return true}
 func windowDidResize(_ notification:Notification){let now=ProcessInfo.processInfo.systemUptime;if now-lastResizeLog>=0.25{lastResizeLog=now;record("WINDOW_RESIZED")}}
 func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication)->Bool{true}
 func applicationShouldTerminate(_ sender:NSApplication)->NSApplication.TerminateReply{
  guard let child=child,child.isRunning else{return .terminateNow};if terminating{return .terminateLater};terminating=true;startupTimer?.invalidate();workspaceTimer?.invalidate();web?.stopLoading();try? input?.fileHandleForWriting.close();child.terminate()
  terminationTimer=Timer.scheduledTimer(withTimeInterval:4,repeats:false){[weak self] _ in guard let self=self else{return};if let child=self.child,child.isRunning{Darwin.kill(child.processIdentifier,SIGKILL)}else{self.finishTermination()}}
  return .terminateLater
 }
 func finishTermination(){terminationTimer?.invalidate();NSApp.reply(toApplicationShouldTerminate:true)}
 func applicationWillTerminate(_ notification:Notification){workspaceTimer?.invalidate();if window != nil,web != nil{desktopGlass.teardown(window:window,web:web,backdrop:backdrop,dark:window.effectiveAppearance.bestMatch(from:[.aqua,.darkAqua]) == .darkAqua)};NSWorkspace.shared.notificationCenter.removeObserver(self);if let monitor=escapeMonitor{NSEvent.removeMonitor(monitor)};appearanceObserver=nil;record("STOPPED");if lockDescriptor>=0{flock(lockDescriptor,LOCK_UN);Darwin.close(lockDescriptor)}}
}
if arguments.contains("--native-layout-check") {
 let app=AppDelegate();var checks:[[String:Any]]=[];var failure=""
 let guarded=ODAStartupRun {
  app.shellRoot.frame=NSRect(x:0,y:0,width:1320,height:860);app.assembleNativeChrome()
  for size in [NSSize(width:1320,height:860),NSSize(width:960,height:650),NSSize(width:1800,height:1000)] {
   for collapsed in [false,true] {
    app.shellRoot.setFrameSize(size);app.applySidebar(animated:false,collapsedOverride:collapsed);app.shellRoot.layoutSubtreeIfNeeded()
    let brand=app.shellRoot.convert(app.nativeBrand.bounds,from:app.nativeBrand),workspace=app.shellRoot.convert(app.webHost.bounds,from:app.webHost)
    let width:CGFloat=collapsed ? 64:240
    let buttons=app.navigation.map{app.shellRoot.convert($0.bounds,from:$0)}
    let buttonsFit=buttons.allSatisfy{abs($0.width-(width-(collapsed ? 20:32)))<1 && abs($0.height-36)<1 && $0.minX>=0 && $0.maxX<=width}
    let ordered=zip(buttons.prefix(7),buttons.dropFirst().prefix(7)).allSatisfy{$0.0.maxY<=$0.1.minY}
    let valid=abs(app.sidebar.frame.width-width)<1 && abs(app.sidebar.frame.height-size.height)<1 && abs(workspace.minX-width)<1 && abs(workspace.minY-64)<1 && abs(workspace.width-(size.width-width))<1 && abs(workspace.height-(size.height-64))<1 && abs(brand.minY-64)<1 && brand.maxX<=width && brand.maxY<size.height && app.navScroll.frame.height>100 && buttonsFit && ordered
    if !valid{failure="NATIVE_GEOMETRY_INVALID"}
    checks.append(["collapsed":collapsed,"size":[size.width,size.height],"valid":valid,"layout":app.layoutSnapshot()])
   }
  }
 }
 if guarded["ok"] as? Bool != true{failure=guarded["code"] as? String ?? "NATIVE_SETUP_EXCEPTION"}
 let result:[String:Any]=["status":failure.isEmpty ? "PASS":"FAIL","failure":failure,"checks":checks,"scope":"ACTUAL_NATIVE_CHROME_WITHOUT_WINDOW_OR_DATABASE","visualAcceptance":"NOT_ASSERTED"]
 print(String(data:try! JSONSerialization.data(withJSONObject:result,options:.prettyPrinted),encoding:.utf8)!);exit(failure.isEmpty ? 0:1)
}
let application=NSApplication.shared
let delegate=AppDelegate();application.delegate=delegate;application.setActivationPolicy(.regular);application.run()
