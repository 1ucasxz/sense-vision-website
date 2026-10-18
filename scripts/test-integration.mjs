import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the original arithmetic engine without executing browser event handlers.
const context = vm.createContext({ document: { addEventListener() {} }, window: {}, console });
for (const file of ['visual', 'simulador']) {
  vm.runInContext(await readFile(new URL(`../js/${file}.js`, import.meta.url), 'utf8'), context);
}
for (const [expr, expected] of [['3+2',5],['(4+2)*3',18],['2^3',8],['raiz(9)',3],['7-4',3],['10/2',5],['2,5+1',3.5],['2-5',-3]]) {
  const result = vm.runInContext(`convertComplex(${JSON.stringify(expr)})`, context);
  assert.equal(result.result, expected, expr);
  assert.ok(!/[0-9]/.test(result.answerHtml.replace(/<[^>]*>/g, '')), 'answer uses pictures, not digits');
}
assert.equal(vm.runInContext('convertComplex("1/0").success', context), false);
assert.equal(vm.runInContext('convertComplex("hello")', context), null);
console.log('Arithmetic: 10 cases passed.');

// Only local, synthetic test data. Never points at a production host.
const base = 'http://127.0.0.1:5174';
let cookie = '';
async function api(path, method = 'GET', data) {
  const response = await fetch(base + path, { method, headers: {
    'Content-Type': 'application/json', Origin: base, ...(cookie ? {Cookie: cookie} : {})
  }, body: data === undefined ? undefined : JSON.stringify(data) });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  return { status: response.status, data: await response.json() };
}
assert.equal((await api('/api/history')).status,401);
const user = {name:'Teste local',email:`qa-${Date.now()}@example.invalid`,password:crypto.randomUUID()};
assert.equal((await api('/api/auth/register','POST',user)).status,200);
assert.equal((await api('/api/auth/login','POST',user)).status,200);
assert.equal((await api('/api/auth/me')).data.user.name,user.name);
const entry = (await api('/api/history','POST',{expr:'(4+2)*3',display:'(4 + 2) × 3 = 18',source:'teclado'})).data.entry;
assert.ok(entry.id);
assert.equal((await api('/api/history')).data.items.length,1);
assert.equal((await api('/api/history/'+encodeURIComponent(entry.id),'DELETE')).status,200);
assert.equal((await api('/api/history')).data.items.length,0);
assert.equal((await api('/api/auth/logout','POST',{})).status,200);
assert.equal((await api('/api/history')).status,401);
assert.equal((await api('/api/status')).data.has_photo,false);
assert.equal((await api('/api/ocr','POST')).status,404);
console.log('Local API: registration, login, session, save/list/delete history, logout and empty camera passed.');
