// Check production and developer pages after moving any frontend files.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const staticRoot=path.join(root,'src/main/resources/static');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
let references=0;
function check(url,base){
  if(/^(data:|https?:|#|%23|about:)/i.test(url))return;
  const clean=url.split(/[?#]/)[0];if(!clean)return;
  const file=clean.startsWith('/')?path.join(staticRoot,clean.slice(1)):path.resolve(base,clean);
  assert.ok(fs.existsSync(file),`Missing asset ${url} referenced from ${base}`);references++;
}
for(const file of walk(staticRoot)){
  const ext=path.extname(file);
  if(ext==='.html'){
    const text=fs.readFileSync(file,'utf8');
    const base=text.includes('<base href="/">')?staticRoot:path.dirname(file);
    for(const match of text.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
      // Inline JS templates are checked through member JSON or by browser tests.
      if(!match[1].includes('${'))check(match[1],base);
    }
  }
  if(ext==='.css')for(const match of fs.readFileSync(file,'utf8').matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g))check(match[1],path.dirname(file));
  if(ext==='.js')execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
}
const members=JSON.parse(fs.readFileSync(path.join(root,'src/main/resources/data/members.json'),'utf8'));
for(const member of members){check(member.photo,staticRoot);for(const page of member.pages)check('assets/borders/'+page.border,staticRoot)}
console.log(`Asset paths OK: ${references} references; all browser JavaScript parsed.`);
