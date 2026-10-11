// SPDX-License-Identifier: MPL-2.0
// Honest availability probe. A package-presence result is never a finance test pass.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const gates=Array.from({length:13},(_,i)=>`F${i+1}`);
const result={candidate:'Actual Budget public Node API',date:new Date().toISOString(),runtime:process.version,sourceObservedVersion:'26.10.0 (v26.10.0 tagged source inspected; not installed)',sourceTag:'v26.10.0',previousUpgradeCandidate:'v26.9.0',installedVersion:null,status:'UNTESTED',cases:gates.map(id=>({id,status:'UNTESTED'})),noNetworkOrSignup:true};
try{
 const api=await import('@actual-app/api');
 const pkg=JSON.parse(readFileSync(require.resolve('@actual-app/api/package.json'),'utf8'));
 result.installedVersion=pkg.version;
 result.availableMethods=['init','shutdown','runImport','createAccount','addTransactions','importTransactions','getTransactions','getAccountBalance','setBudgetAmount','exportBudget','importBudget'].map(name=>({name,available:typeof (api.default||api)[name]==='function'}));
 result.status='AVAILABLE — runtime scenarios still UNTESTED';
 result.reason='Stop and implement a native adapter using supported public APIs. Package availability alone does not execute the canonical contract.';
}catch(error){result.status='BLOCKED';result.reason='@actual-app/api is not installed; npm registry DNS is unavailable and the package is absent from the local cache.';result.error={code:error.code,message:error.message};result.cases=result.cases.map(c=>({...c,status:'BLOCKED',reason:result.reason}));}
mkdirSync('artifacts',{recursive:true});writeFileSync(process.env.ACTUAL_PROBE_OUTPUT||'artifacts/actual-availability.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
// Diagnostic exit success means the probe completed; status BLOCKED is not a pass.
