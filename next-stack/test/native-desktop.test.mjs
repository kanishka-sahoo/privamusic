import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopUpgradeAllowed} from '../src/native-desktop.mjs';
test('desktop socket requires authentication, exact path, and matching Origin including port',()=>{
 const req={url:'/native/websockify',headers:{host:'server.example:18780',origin:'https://server.example:18780'}};
 assert.equal(desktopUpgradeAllowed(req,()=>true),true);
 assert.equal(desktopUpgradeAllowed(req,()=>false),false);
 assert.equal(desktopUpgradeAllowed({...req,url:'/other'},()=>true),false);
 for(const origin of [undefined,'null','https://attacker.example','https://server.example:4533'])assert.equal(desktopUpgradeAllowed({...req,headers:{...req.headers,origin}},()=>true),false);
});
test('desktop static files reject encoded traversal and malformed escapes',async()=>{
 const {proxyDesktop}=await import('../src/native-desktop.mjs');
 for(const url of ['/native/client/%ZZ.js','/native/client/%2e%2e%2fpackage.json','/native/client/%2e%2e%2f%2e%2e%2fsecret.js']){
  let status;const response={writeHead(code){status=code;return this;},end(){}};
  await proxyDesktop({url},response);assert.equal(status,404);
 }
});
