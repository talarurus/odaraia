// SPDX-License-Identifier: MIT
// Local experimental adaptation of MonoCode's native glass sequence.
// Copyright (c) 2026 Nick. MIT notice: third-party/monocode/LICENSE.
// Private WindowServer AND private WebKit KVC. Never linked by the public build.
#import "ExperimentalGlassBridge.h"
#include <dlfcn.h>
#include <stdint.h>
typedef uintptr_t (*ODAConnection)(void);
typedef int (*ODABlur)(uintptr_t, int, int);
static ODABlur blurFunction(void) { return (ODABlur)dlsym(RTLD_DEFAULT,"CGSSetWindowBackgroundBlurRadius"); }
static ODAConnection connectionFunction(void) {
 ODAConnection fn=(ODAConnection)dlsym(RTLD_DEFAULT,"CGSDefaultConnectionForThread");
 return fn ?: (ODAConnection)dlsym(RTLD_DEFAULT,"CGSMainConnectionID");
}
BOOL ODAGlassConfigure(WKWebViewConfiguration *configuration) {
 @try {
  // Wry disables background drawing BEFORE WKWebView initialization. Merely
  // clearing the public under-page color cannot replace this private switch.
  [configuration setValue:@NO forKey:@"drawsBackground"];
  return ![[configuration valueForKey:@"drawsBackground"] boolValue];
 } @catch (NSException *exception) { return NO; }
}
BOOL ODAGlassSetDrawing(WKWebView *web, BOOL drawsBackground) {
 @try {
  [web setValue:@(drawsBackground) forKey:@"drawsBackground"];
  return [[web valueForKey:@"drawsBackground"] boolValue] == drawsBackground;
 } @catch (NSException *exception) { return NO; }
}
NSDictionary *ODAGlassProbe(void) {
 return @{ @"blurSymbolAvailable":@(blurFunction()!=NULL), @"connectionSymbolAvailable":@(connectionFunction()!=NULL), @"classification":@"PRIVATE_LOCAL_EXPERIMENT" };
}
NSInteger ODAGlassBlur(NSWindow *window, NSInteger radius) {
 ODABlur blur=blurFunction(); ODAConnection connection=connectionFunction();
 if(!blur || !connection)return -1000;
 uintptr_t identifier=connection(); if(!identifier)return -1001;
 if(window.windowNumber<=0)return -1002;
 return blur(identifier,(int)window.windowNumber,(int)MAX(0,MIN(64,radius)));
}
