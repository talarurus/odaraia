// SPDX-License-Identifier: MPL-2.0
// Internal trusted storage contract; never exposed as a SQL/IPC capability.
export interface ImportRecord {file_key:string;account:string;name:string;time:string;result:string}
export interface SourceAlias {source_key:string;transaction_id:string;evidence:string}
export interface AuditRecord {id:string;time:string;action:string;entity:string;before_json:string|null;after_json:string}
export interface PreviewRecord {payload:string;created_at:string}
