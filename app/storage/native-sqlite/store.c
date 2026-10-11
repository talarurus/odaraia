// SPDX-License-Identifier: MPL-2.0
// Experimental durable adapter. SQLite provides parsing, locking and journaling.
// No filesystem path or SQL statement is accepted from web content.
#include "store.h"
#include "schema.h"
#include <sqlite3.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <sys/stat.h>
#ifndef _WIN32
#include <unistd.h>
#endif
#define LIMIT (32*1024*1024)
#define COUNT(a) (sizeof(a)/sizeof((a)[0]))
static int run(sqlite3 *db,const char *sql){return sqlite3_exec(db,sql,0,0,0)==SQLITE_OK;}
static char *copy(const char *s){size_t n=strlen(s)+1;char *v=malloc(n);if(v)memcpy(v,s,n);return v;}
static char *error(const char *code){char s[128];snprintf(s,sizeof(s),"{\"error\":\"%s\",\"code\":\"%s\"}",code,code);return copy(s);}
static sqlite3_stmt *prepare(sqlite3 *db,const char *sql,const char *request){sqlite3_stmt *s=0;if(sqlite3_prepare_v2(db,sql,-1,&s,0)!=SQLITE_OK)return 0;if(request)sqlite3_bind_text(s,1,request,-1,SQLITE_TRANSIENT);return s;}
static int truth(sqlite3 *db,const char *sql,const char *request){sqlite3_stmt *s=prepare(db,sql,request);if(!s)return 0;int ok=sqlite3_step(s)==SQLITE_ROW&&sqlite3_column_int(s,0)==1;sqlite3_finalize(s);return ok;}
static int step(sqlite3 *db,const char *sql,const char *request){sqlite3_stmt *s=prepare(db,sql,request);if(!s)return 0;int ok=sqlite3_step(s)==SQLITE_DONE;sqlite3_finalize(s);return ok;}
static sqlite3_int64 integer(sqlite3 *db,const char *sql){sqlite3_stmt *s=prepare(db,sql,0);sqlite3_int64 v=-1;if(s&&sqlite3_step(s)==SQLITE_ROW)v=sqlite3_column_int64(s,0);sqlite3_finalize(s);return v;}
static char *string(sqlite3 *db,const char *sql,const char *request){sqlite3_stmt *s=prepare(db,sql,request);char *v=0;if(s&&sqlite3_step(s)==SQLITE_ROW){const unsigned char *p=sqlite3_column_text(s,0);if(p)v=copy((const char*)p);}sqlite3_finalize(s);return v;}
static int integrity(sqlite3 *db){
 return truth(db,"SELECT NOT EXISTS(SELECT 1 FROM pragma_foreign_key_check)",0)
 &&truth(db,"SELECT NOT EXISTS(SELECT 1 FROM accounts WHERE length(id) NOT BETWEEN 1 AND 100 OR id GLOB '*[^a-zA-Z0-9_-]*' OR length(name) NOT BETWEEN 1 AND 200 OR anchor NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR anchor!=COALESCE(date(anchor,'+0 days'),''))",0)
 &&truth(db,"SELECT NOT EXISTS(SELECT 1 FROM transactions t JOIN accounts a ON t.account=a.id WHERE t.date<=a.anchor OR t.date!=COALESCE(date(t.date,'+0 days'),'') OR length(t.date)!=10 OR t.date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' OR length(t.id) NOT BETWEEN 1 AND 100 OR t.id GLOB '*[^a-zA-Z0-9_-]*' OR length(t.payee) NOT BETWEEN 1 AND 200 OR length(t.category) NOT BETWEEN 1 AND 200 OR length(t.note)>4000 OR length(t.source_key) NOT BETWEEN 1 AND 400 OR (t.source_id IS NOT NULL AND length(t.source_id) NOT BETWEEN 1 AND 200))",0)
 &&truth(db,"SELECT NOT EXISTS(SELECT 1 FROM transactions a WHERE a.transfer_id IS NOT NULL AND (a.status='pending' OR length(a.transfer_id) NOT BETWEEN 1 AND 100 OR a.transfer_id GLOB '*[^a-zA-Z0-9_-]*' OR (SELECT count(*) FROM transactions b WHERE b.transfer_id=a.transfer_id)!=2 OR NOT EXISTS(SELECT 1 FROM transactions b WHERE b.transfer_id=a.transfer_id AND b.id!=a.id AND b.account!=a.account AND b.date=a.date AND b.status=a.status AND CASE WHEN a.amount=-9223372036854775808 THEN 0 ELSE b.amount=-a.amount END)))",0)
 &&truth(db,"SELECT NOT EXISTS(SELECT 1 FROM budgets WHERE length(category) NOT BETWEEN 1 AND 200 OR length(month)!=7 OR month||'-01'!=COALESCE(date(month||'-01','+0 days'),'') OR month NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]')",0)
 &&truth(db,"SELECT NOT EXISTS(SELECT 1 FROM source_aliases a JOIN transactions t ON a.source_key=t.source_key WHERE a.transaction_id!=t.id)",0)
 &&truth(db,"SELECT NOT EXISTS(SELECT 1 FROM previews WHERE json_extract(payload,'$.id') IS NOT id OR json_extract(payload,'$.account') IS NOT account OR json_extract(payload,'$.fileKey') IS NOT file_key)",0);
}
static char *store_once(const char *path,const char *request){
 sqlite3 *db=0;char *result=0,*op=0;const char *failure="STORAGE_FAILURE";int transaction=0;
 if(!path||!request||strlen(request)>LIMIT)return error("INVALID_REQUEST");
#ifndef _WIN32
 // NOFOLLOW also protects against a race between this check and SQLite open.
 struct stat st;if(lstat(path,&st)==0&&(!S_ISREG(st.st_mode)||S_ISLNK(st.st_mode)))return error("UNSAFE_PATH");
#endif
 int flags=SQLITE_OPEN_READWRITE|SQLITE_OPEN_CREATE|SQLITE_OPEN_FULLMUTEX;
#ifdef SQLITE_OPEN_NOFOLLOW
 flags|=SQLITE_OPEN_NOFOLLOW;
#endif
 if(sqlite3_open_v2(path,&db,flags,0)!=SQLITE_OK)goto done;
#ifndef _WIN32
 if(chmod(path,0600)!=0)goto done;
#endif
 sqlite3_limit(db,SQLITE_LIMIT_LENGTH,LIMIT);
 sqlite3_busy_timeout(db,5000);
 if(!run(db,"PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;"))goto done;
 // Check before migrations or any financial-table write; never repair/reset.
 if(!truth(db,"SELECT NOT EXISTS(SELECT 1 FROM pragma_quick_check WHERE quick_check!='ok')",0)||!truth(db,"SELECT NOT EXISTS(SELECT 1 FROM pragma_foreign_key_check)",0)){failure="CORRUPT_STORE";goto done;}
 if(!run(db,"PRAGMA journal_mode=WAL; BEGIN IMMEDIATE"))goto done;transaction=1;
 sqlite3_int64 schema=integer(db,"PRAGMA user_version");
 if(schema<0||schema>3){failure="UNSUPPORTED_SCHEMA";goto done;}
 for(int i=(int)schema;i<3;i++)if(!run(db,migrations[i])){failure="MIGRATION_FAILED";goto done;}
 if(!run(db,"PRAGMA user_version=3; CREATE TABLE IF NOT EXISTS prototype_meta(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL CHECK(revision>=0)) STRICT; INSERT OR IGNORE INTO prototype_meta VALUES(1,0); COMMIT"))goto done;transaction=0;
 if(!truth(db,"SELECT json_valid(?1) AND json_type(?1)='object'",request)){failure="INVALID_REQUEST";goto done;}
 op=string(db,"SELECT json_extract(?1,'$.op')",request);
 if(!op|| (strcmp(op,"read")&&strcmp(op,"commit"))){failure="UNKNOWN_OPERATION";goto done;}
 if(!strcmp(op,"read")&&!truth(db,"SELECT NOT EXISTS(SELECT 1 FROM json_each(?1) WHERE key!='op')",request)){failure="INVALID_REQUEST";goto done;}
 if(!run(db,strcmp(op,"commit")==0?"BEGIN IMMEDIATE":"BEGIN"))goto done;transaction=1;
 if(!integrity(db)){failure="INVALID_STORED_DATA";goto done;}
 sqlite3_int64 revision=integer(db,"SELECT revision FROM prototype_meta WHERE id=1");
 if(revision<0||revision>=9007199254740991LL){failure="INVALID_REVISION";goto done;}
 if(!strcmp(op,"commit")){
  for(size_t i=0;i<COUNT(validations);i++)if(!truth(db,validations[i],request)){failure="INVALID_SNAPSHOT";goto done;}
  sqlite3_stmt *s=prepare(db,"SELECT json_extract(?1,'$.expected')",request);if(!s||sqlite3_step(s)!=SQLITE_ROW){sqlite3_finalize(s);goto done;}sqlite3_int64 expected=sqlite3_column_int64(s,0);sqlite3_finalize(s);
  if(expected!=revision){failure="CONFLICT";goto done;}
  // Retain existing identities and append-only recovery/import evidence. Even a
  // compromised renderer cannot use this operation as a database-reset command.
  if(!truth(db,"SELECT NOT EXISTS(SELECT 1 FROM accounts a WHERE NOT EXISTS(SELECT 1 FROM json_each(?1,'$.data.accounts') r WHERE json_extract(r.value,'$.id')=a.id AND json_extract(r.value,'$.currency')=a.currency AND json_extract(r.value,'$.revision') BETWEEN a.revision AND a.revision+1))",request)
   ||!truth(db,"SELECT NOT EXISTS(SELECT 1 FROM transactions t WHERE NOT EXISTS(SELECT 1 FROM json_each(?1,'$.data.transactions') r WHERE json_extract(r.value,'$.id')=t.id AND json_extract(r.value,'$.sourceKey')=t.source_key AND json_extract(r.value,'$.sourceId') IS t.source_id AND COALESCE(json_extract(r.value,'$.provenance'),'null')=t.provenance AND json_extract(r.value,'$.revision') BETWEEN t.revision AND t.revision+1))",request)
   ||!truth(db,"SELECT NOT EXISTS(SELECT 1 FROM audit a WHERE NOT EXISTS(SELECT 1 FROM json_each(?1,'$.data.audit') r WHERE json_extract(r.value,'$.id')=a.id AND json_extract(r.value,'$.time')=a.time AND json_extract(r.value,'$.action')=a.action AND json_extract(r.value,'$.entity')=a.entity AND json_extract(r.value,'$.before_json') IS a.before_json AND json_extract(r.value,'$.after_json')=a.after_json))",request)
   ||!truth(db,"SELECT NOT EXISTS(SELECT 1 FROM imports i WHERE NOT EXISTS(SELECT 1 FROM json_each(?1,'$.data.imports') r WHERE json_extract(r.value,'$.file_key')=i.file_key AND json_extract(r.value,'$.account')=i.account AND json_extract(r.value,'$.name')=i.name AND json_extract(r.value,'$.time')=i.time AND json_extract(r.value,'$.result')=i.result))",request)
   ||!truth(db,"SELECT NOT EXISTS(SELECT 1 FROM source_aliases a WHERE NOT EXISTS(SELECT 1 FROM json_each(?1,'$.data.sourceAliases') r WHERE json_extract(r.value,'$.source_key')=a.source_key AND json_extract(r.value,'$.transaction_id')=a.transaction_id AND json_extract(r.value,'$.evidence')=a.evidence))",request)
   ||!truth(db,"SELECT NOT EXISTS(SELECT 1 FROM budgets b WHERE NOT EXISTS(SELECT 1 FROM json_each(?1,'$.data.budgets') r WHERE json_extract(r.value,'$.month')=b.month AND json_extract(r.value,'$.category')=b.category))",request)){failure="IDENTITY_CHANGE_REFUSED";goto done;}
  // All records replaced in ONE transaction with FK enforcement and exact int64.
  // The prototype operates exclusively on its own synthetic profile.
  if(!run(db,"DELETE FROM source_aliases; DELETE FROM previews; DELETE FROM imports; DELETE FROM transactions; DELETE FROM budgets; DELETE FROM audit; DELETE FROM accounts;"))goto done;
  for(size_t i=0;i<COUNT(inserts);i++)if(!step(db,inserts[i],request)){failure="CONSTRAINT_FAILED";goto done;}
  if(!integrity(db)){failure="INVALID_FINANCIAL_DATA";goto done;}
  if(!run(db,"UPDATE prototype_meta SET revision=revision+1 WHERE id=1"))goto done;
#ifdef ODARAIA_TESTING
  // Compiled only into the fault-test executable, never into Tauri/normal CLI.
  if(getenv("ODARAIA_TEST_CRASH"))_Exit(86);
#endif
  revision++;
 }
 char *data=string(db,read_data,0);if(!data)goto done;
 size_t length=strlen(data)+128;result=malloc(length);if(result)snprintf(result,length,"{\"revision\":%lld,\"data\":%s}",revision,data);free(data);
 if(!result||!run(db,"COMMIT")){free(result);result=0;goto done;}transaction=0;
 done:
 if(!result&&db&&((sqlite3_errcode(db)&255)==SQLITE_BUSY||(sqlite3_errcode(db)&255)==SQLITE_LOCKED))failure="BUSY";
 if(transaction&&db)run(db,"ROLLBACK");
 free(op);if(db)sqlite3_close(db);
 return result?result:error(failure);
}
char *odaraia_store(const char *path,const char *request){
 // Changing journal mode during simultaneous first opens can return BUSY without
 // invoking SQLite's busy handler. Retry only rolled-back/unsaved operations.
 for(int attempt=0;attempt<12;attempt++){
  char *result=store_once(path,request);
  if(!result||strcmp(result,"{\"error\":\"BUSY\",\"code\":\"BUSY\"}")||attempt==11)return result;
  free(result);sqlite3_sleep(25*(attempt+1));
 }
 return error("BUSY");
}
void odaraia_free(char *result){free(result);}
