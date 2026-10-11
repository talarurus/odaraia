// SPDX-License-Identifier: MPL-2.0
#import <Foundation/Foundation.h>
NS_ASSUME_NONNULL_BEGIN
// Public Objective-C exception boundary for terminal setup diagnostics only.
// Never resume a partially assembled hierarchy after failure. No exception
// reasons, stack traces or UI data escape into logs or the web bridge.
NSDictionary *ODAStartupRun(void (NS_NOESCAPE ^operation)(void));
NS_ASSUME_NONNULL_END
