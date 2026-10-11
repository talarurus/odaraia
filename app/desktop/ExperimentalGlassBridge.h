// SPDX-License-Identifier: MPL-2.0
#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>
NS_ASSUME_NONNULL_BEGIN
// These functions are linked ONLY by the explicit local experimental build.
BOOL ODAGlassConfigure(WKWebViewConfiguration *configuration);
BOOL ODAGlassSetDrawing(WKWebView *web, BOOL drawsBackground);
NSDictionary *ODAGlassProbe(void);
NSInteger ODAGlassBlur(NSWindow *window, NSInteger radius);
NS_ASSUME_NONNULL_END
