// SPDX-License-Identifier: MPL-2.0
#ifndef ODARAIA_STORE_H
#define ODARAIA_STORE_H
// Trusted host chooses path. Result is allocated; release with odaraia_free.
char *odaraia_store(const char *path, const char *request);
void odaraia_free(char *result);
#endif
