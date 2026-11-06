/** Validate sourced membership, parody identity, aligned profiles, and existing-save preservation. */
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const catalog=JSON.parse(readFileSync('scripts/nba-rosters-current.json','utf8'));
const result=await build({stdin:{resolveDir:process.cwd(),contents:`
  import {strict as assert} from 'node:assert';
  import {createLeague} from './src/data/league';
  import {buildCustomFranchise} from './src/data/scenarios';
  import {getTeamParodyRoster,pickDraftClassParodyName} from './src/data/parodyRoster';
  import {PROBALLERS_RATINGS} from './src/data/proballersRatings';
  import {generateTeamRoster} from './src/engine/leagueRosters';
  import {normalizeLoadedRoster} from './src/data/rosterBuilder';
  const catalog=${JSON.stringify(catalog)};
  const league=createLeague(1,'LA','Cosmos',80,{wins:0,losses:0},'contend');
  const seenNames=new Set(),seenIds=new Set();let count=0;
  const norm=s=>s.normalize('NFD').replace(/\\p{M}/gu,'').toLowerCase().replace(/[^a-z]/g,'');
  const distance=(a,b)=>{const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];};
  for(const [key,source] of Object.entries(catalog.teams)){
    const [city,name]=key.split('|');const aliases=getTeamParodyRoster(city,name),ratings=PROBALLERS_RATINGS[key];
    assert.equal(aliases.length,source.length,key+' membership');assert.equal(ratings.length,18,key+' profiles');
    const team=league.teams.find(t=>t.city===city&&t.name===name);assert.ok(team,key);
    const roster=generateTeamRoster(team),fresh=buildCustomFranchise(city,name,team.market??'Mid');
    assert.equal(roster.length,18);assert.equal(fresh.roster.length,18);
    source.forEach((real,i)=>{
      const alias=aliases[i],label=alias.firstName+' '+alias.lastName;
      assert.deepEqual(alias,real.parody,key+' alias alignment');
      assert.equal(alias.firstName[0].toLowerCase(),real.firstName[0].toLowerCase(),real.name+' initial');
      assert.notEqual(norm(alias.firstName),norm(real.firstName),real.name+' fictional first');
      assert.equal(distance(norm(alias.lastName),norm(real.lastName)),1,real.name+' one surname typo');
      assert.ok(!seenNames.has(label),'duplicate parody '+label);seenNames.add(label);
      assert.ok(!seenIds.has(real.id),'duplicate source identity');seenIds.add(real.id);
      assert.equal(ratings[i].sourcePlayerId,real.id);assert.equal(ratings[i].age,real.age);
      for(const generated of [roster,fresh.roster]){const p=generated.find(p=>p.firstName===alias.firstName&&p.lastName===alias.lastName);assert.ok(p,key+' missing '+label);assert.equal(p.age,real.age);assert.equal(p.overall,ratings[i].overall);}
      count++;
    });
    const saved={...fresh,id:'saved',roster:fresh.roster.slice(0,12)};saved.roster[0]={...saved.roster[0],firstName:'Saved',lastName:'Trade',overall:91};
    assert.deepEqual(normalizeLoadedRoster(saved,saved.roster),saved.roster,'existing career was rewritten');
  }
  for(let salt=0;salt<25;salt++){const prospect=pickDraftClassParodyName(new Set(),salt);if(prospect)assert.ok(!seenNames.has(prospect.firstName+' '+prospect.lastName),'roster player duplicated in draft');}
  assert.equal(count,519);assert.equal(catalog.excluded.length,2);
  const lakers=catalog.teams['LA|Cosmos'];assert.ok(lakers.some(p=>p.name==='Luka Doncic'&&p.parody.firstName==='Landon'&&p.parody.lastName==='Doncicc'));
  assert.ok(!lakers.some(p=>p.name==='LeBron James'));
  assert.ok(catalog.teams['Philadelphia|Colonials'].some(p=>p.name==='LeBron James'&&p.parody.firstName==='Leandro'));
  assert.ok(catalog.teams['Miami|Surge'].some(p=>p.name==='Giannis Antetokounmpo'));
  console.log('PASS: 30 teams, '+count+' current identities, one-typo names, profile alignment, new franchises, save preservation, and draft exclusivity');
`},bundle:true,platform:'node',format:'esm',write:false});
try { await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64')); } catch (error) { console.error(error.message); process.exitCode=1; }
