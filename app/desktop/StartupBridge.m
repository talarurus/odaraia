// SPDX-License-Identifier: MPL-2.0
#import "StartupBridge.h"
NSDictionary *ODAStartupRun(void (NS_NOESCAPE ^operation)(void)) {
 @try { operation(); return @{ @"ok":@YES }; }
 @catch (NSException *exception) {
  NSString *code=[exception.reason containsString:@"common ancestor"] ? @"LAYOUT_COMMON_ANCESTOR":@"NATIVE_SETUP_EXCEPTION";
  return @{ @"ok":@NO, @"code":code };
 }
}
