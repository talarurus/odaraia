// SPDX-License-Identifier: MPL-2.0
// Existing v1 backup identity is retained for compatibility across app names.
export const SCHEMA_VERSION=3;
export const BACKUP_FORMAT='talarurus-finance';
export const BACKUP_VERSION=1;
export const utf8Size=(value:string)=>new TextEncoder().encode(value).byteLength;
