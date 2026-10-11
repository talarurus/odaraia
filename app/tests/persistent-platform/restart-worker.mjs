// SPDX-License-Identifier: MPL-2.0
import {createAsyncNativeService} from '../../storage/async-native.ts';
import {processTransport} from '../../storage/native-sqlite/transport.mjs';
const s=createAsyncNativeService(processTransport(process.argv[3]));
if(process.argv[2]==='write'){
 const a=await s.execute({name:'accounts.create',input:{name:'Fictional restart account',type:'checking',anchor:'2026-08-31',opening:'125000'}});
 await s.execute({name:'transactions.create',input:{account:a.id,date:'2026-09-01',amount:'99',payee:'Fictional refund',category:'Other',classification:'expense'}});
}
const backup=await s.execute({name:'backup.read'}),report=await s.execute({name:'reports.read'});
console.log(JSON.stringify({data:backup.data,balance:report.netWorth}));
