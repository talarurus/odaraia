// SPDX-License-Identifier: MPL-2.0
// Deliberate source allowlist. No remote, broad staging, credential reads or DB opens.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync,lstatSync,existsSync,realpathSync} from 'node:fs';
import {resolve,join,relative,dirname,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=realpathSync(resolve(import.meta.dirname,'..'));
const mode=process.argv[2]||'audit',out=join(root,'app/artifacts/v031');mkdirSync(out,{recursive:true});
const digest=b=>createHash('sha256').update(b).digest('hex');
const config=JSON.parse(readFileSync(join(root,'release/source-files.json'),'utf8'));
const paths=config.files;
if(new Set(paths).size!==paths.length)throw Error('Duplicate source paths');
const forbidden=/(^|\/)(node_modules|target|dist|artifacts|data|profiles|backups|references|\.git|cargo-home|gen)(\/|$)|(^|\/)\.env(?:\.|$)|\.(sqlite.*|db|db-.*|log|jsonl|pem|key|p12|pfx|mobileprovision|zip|dmg|exe|app|a|o|so|dylib)$/i;
for(const p of paths){
 if(p.startsWith('/')||p.startsWith('-')||/[\r\n\0]/.test(p)||p.split('/').includes('..')||p.includes('\\')||forbidden.test(p))throw Error('Disallowed source path: '+p);
 const full=join(root,p);
 if(!lstatSync(full).isFile()||lstatSync(full).isSymbolicLink()||realpathSync(full)!==full)throw Error('Source must be a real in-tree file: '+p);
}
const rules=[
 ['credential',/\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk_(?:live|proj)_[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{20,})\b/g],
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g],
 ['private-path',/\/(?:Users|home)\/(?!example\b|fictional\b)[A-Za-z0-9_.-]+\//g],
 ['credential-literal',/\b(?:password|passphrase|secret|token|credential|launchSecret|sessionToken|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*['"][^'"\n]{4,}['"]/gi],
 ['email',/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
 ['financial-identifier',/\b[A-Z]{2}[0-9]{2}(?:[ ]?[A-Z0-9]){11,30}\b/g]
];
if(mode==='inventory'){
 const proposed=new Set(paths),excluded=[],included=[];
 const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){
  const p=join(dir,entry.name),name=relative(root,p).split(sep).join('/');
  if(name==='release/odaraia-source'||name==='.git')continue;
  if(entry.isDirectory())walk(p);else (proposed.has(name)?included:excluded).push({path:name,bytes:lstatSync(p).size,symlink:entry.isSymbolicLink()});
 }};walk(root);
 const report={scope:'Filename/size inventory only; excluded content and financial DBs never opened',proposedFileCount:included.length,excludedFileCount:excluded.length,excludedBytes:excluded.reduce((s,v)=>s+v.bytes,0),included,excluded};
 writeFileSync(join(out,'workspace-inventory.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({proposed:report.proposedFileCount,excluded:report.excludedFileCount,excludedBytes:report.excludedBytes}));
}else if(mode==='prepare'){
 const destination=join(root,'release/odaraia-source');
 if(existsSync(destination))throw Error('Curated tree already exists. Audit it; preserve it rather than overwrite staged review work.');
 for(const p of paths){const target=join(destination,p);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(root,p),target);}
 execFileSync('git',['init','-b','main',destination],{stdio:'pipe'});
 console.log('Prepared local source tree. No commits, identity, remote or staging created. Run its audit before staging an explicit manifest.');
}else if(mode==='audit'||mode==='archive'||mode==='stage'){
 const reviewed=JSON.parse(readFileSync(join(root,'release/audit-reviewed.json'),'utf8'));
 const findings=[],files=[],failures=[],used=new Set();
 for(const p of paths){
  const bytes=readFileSync(join(root,p)),sha256=digest(bytes);files.push({path:p,bytes:bytes.length,sha256});
  if(bytes.length>2*1024*1024)failures.push({path:p,reason:'Source exceeds 2 MiB review limit'});
  const binary=bytes.includes(0)||['.png','.icns','.ico','.woff2'].includes(extname(p));
  if(binary){if(config.binaryAssets[p]!==sha256)failures.push({path:p,reason:'Unapproved binary/hash'});continue;}
  const text=bytes.toString('utf8');
  if(bytes.subarray(0,16).equals(Buffer.from('SQLite format 3\0')))failures.push({path:p,reason:'Database signature'});
  for(const [rule,pattern] of rules){pattern.lastIndex=0;let m;
   while((m=pattern.exec(text))){const line=text.slice(0,m.index).split('\n').length,lineText=text.split('\n')[line-1],fingerprint=digest(lineText),key=p+':'+rule+':'+fingerprint;
    const review=reviewed.find(v=>v.path===p&&v.rule===rule&&v.fingerprint===fingerprint);
    if(review)used.add(key);
    findings.push({path:p,rule,line,fingerprint,disposition:review?.reason||'NEEDS REVIEW'});
   }
  }
 }
 let git={present:false,commits:0,tracked:0,remotes:0};
 if(existsSync(join(root,'.git'))){
  const run=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const tracked=run(['ls-files','-z']).split('\0').filter(Boolean);git={present:true,commits:run(['rev-list','--all']).split('\n').filter(Boolean).length,tracked:tracked.length,remotes:run(['remote']).split('\n').filter(Boolean).length};
  for(const p of tracked)if(!paths.includes(p))failures.push({path:p,reason:'Tracked file outside reviewed source allowlist'});
  const algorithm=run(['rev-parse','--show-object-format']);
  const stale=[];
  for(const row of run(['ls-files','--stage','-z']).split('\0').filter(Boolean)){
   const match=row.match(/^(\d+) ([a-f0-9]+) (\d)\t(.+)$/s);if(!match)throw Error('Unrecognized index entry');
   const [,mode,object,stage,p]=match;
   if(stage!=='0'||!['100644','100755'].includes(mode))failures.push({path:p,reason:'Nonregular/unmerged index entry'});
   if(!paths.includes(p))continue;
   const bytes=readFileSync(join(root,p)),id=createHash(algorithm).update('blob '+bytes.length+'\0').update(bytes).digest('hex');
   if(id!==object)stale.push(p);
  }
  git.indexMatchesWorkingTree=stale.length===0;
  if(stale.length&&mode!=='stage')failures.push({reason:'Staged bytes differ from reviewed current source; deliberately re-stage then audit',paths:stale});
  const untracked=run(['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
  for(const p of untracked)if(!paths.includes(p))failures.push({path:p,reason:'Untracked nonignored file outside source allowlist'});
  // .gitignore never cleans history. This source preparation expects no commits.
  const ci=process.argv.includes('--ci-checkout')&&process.env.CI==='true';
  git.historyAudited=false;git.scope=ci?'CI checkout: current source/index only; history and remote publication approval excluded':'Unborn local publication tree';
  if(git.commits&&!ci)failures.push({reason:'History exists: inspect every historic blob before approving publication; this audit does not certify history'});
  if(git.remotes&&!ci)failures.push({reason:'Unexpected remote in founder-review tree'});
 }
 const unresolved=findings.filter(v=>v.disposition==='NEEDS REVIEW');
 const report={status:failures.length||unresolved.length?'REVIEW REQUIRED':'PASS',scope:'Allowlisted source and index only; signatures/literals/path/identity/binary checks plus manual dispositions; not a comprehensive secret scanner or dependency advisory scan',fileCount:files.length,bytes:files.reduce((s,v)=>s+v.bytes,0),git,failures,findings,unresolved:unresolved.length};
 writeFileSync(join(out,'publication-audit.json'),JSON.stringify(report,null,2)+'\n');
 writeFileSync(join(out,'proposed-tracked-manifest.json'),JSON.stringify(files,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,files:report.fileCount,bytes:report.bytes,findings:findings.length,unresolved:unresolved.length,failures,git},null,2));
 if(report.status!=='PASS'){process.exitCode=1;}
 else if(mode==='stage'){
  if(!git.present||git.commits||git.remotes)throw Error('Staging requires a local, unborn, remote-free review repository');
  // Feed exact paths over stdin; no shell interpolation and no git add .
  execFileSync('git',['add','--pathspec-from-file=-','--pathspec-file-nul'],{cwd:root,input:paths.join('\0')+'\0',stdio:['pipe','pipe','pipe']});console.log('Staged explicit reviewed manifest only; no commit.');
 }else if(mode==='archive'){
  const folder=join(root,'release/archives');mkdirSync(folder,{recursive:true});
  const filename='plainbalance-v0.3.1-source-review.tar.gz',archive=join(folder,filename);
  // macOS otherwise injects AppleDouble ._ entries with Finder/xattr metadata.
  execFileSync('tar',['-czf',archive,'-T','-'],{cwd:root,env:{...process.env,COPYFILE_DISABLE:'1'},input:paths.join('\n')+'\n',stdio:['pipe','pipe','pipe']});
  writeFileSync(archive+'.sha256',digest(readFileSync(archive))+'  '+filename+'\n');console.log('Local reviewed source archive generated; no binary release or upload.');
 }
}else throw Error('Use inventory, prepare, audit, stage or archive');
