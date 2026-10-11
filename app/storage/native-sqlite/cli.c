// SPDX-License-Identifier: MPL-2.0
// Test/development transport only. Production Tauri calls the C library in-process.
#include "store.h"
#include <stdio.h>
#include <stdlib.h>
#ifndef _WIN32
#include <sys/stat.h>
#endif
int main(int argc,char **argv){
 if(argc!=2)return 2;
#ifndef _WIN32
 umask(0077);
#endif
 size_t cap=32*1024*1024;char *input=malloc(cap+2);if(!input)return 2;
 size_t n=fread(input,1,cap+1,stdin);if(n>cap||ferror(stdin)){free(input);return 2;}input[n]=0;
 char *result=odaraia_store(argv[1],input);free(input);if(!result)return 2;puts(result);odaraia_free(result);return 0;
}
