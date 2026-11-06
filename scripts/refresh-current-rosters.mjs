/** Regenerate current roster templates and aligned profiles from an audited public snapshot. */
import { readFileSync, writeFileSync } from 'node:fs';
import { FIRST_BY_LETTER, toParody, typoSurname } from './sync-nba-rosters.mjs';
const SNAPSHOT = '2026-11-06';
const teams = {
  'Boston|Harbor':'BOS','Brooklyn|Union':'BKN','New York|Skyline':'NYK','Philadelphia|Colonials':'PHI','Toronto|Sentinel':'TOR',
  'Chicago|Gale':'CHI','Cleveland|Rust':'CLE','Detroit|Assembly':'DET','Indiana|Velocity':'IND','Milwaukee|Hops':'MIL',
  'Atlanta|Peachtree':'ATL','Charlotte|Mint':'CHA','Miami|Surge':'MIA','Orlando|Aurora':'ORL','Washington|Monument':'WAS',
  'Denver|Altitude':'DEN','Minnesota|Northstar':'MIN','Oklahoma City|Voltage':'OKC','Portland|Rose':'POR','Utah|Mesa':'UTA',
  'Golden State|Spectrum':'GSW','LA|Current':'LAC','LA|Cosmos':'LAL','Phoenix|Sol':'PHX','Sacramento|Republic':'SAC',
  'Dallas|Lasso':'DAL','Houston|Comets':'HOU','Memphis|Sound':'MEM','New Orleans|Bayou':'NOP','San Antonio|Mission':'SAS',
};
export const canonicalName = s => s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z]/g,'');
const registry = JSON.parse(readFileSync('scripts/roster-name-registry.json','utf8'));
const stats = [...Object.values(JSON.parse(readFileSync('scripts/proballers-stats-2026.json','utf8'))).flat().map(p => ({...p,season:'2025-26',year:2026})), ...JSON.parse(readFileSync(`research/rosters-${SNAPSHOT}/historical-stats.json`, 'utf8'))];
const statKey = name => canonicalName(name).replace(/(jr|iii|ii|iv)$/, '');
const profiles = new Map();
for (const p of stats) { const key=statKey(p.name); if (!profiles.has(key) || p.year > profiles.get(key).year || (p.year === profiles.get(key).year && p.games > profiles.get(key).games)) profiles.set(key,p); }
// The provider occasionally uses long-form first names or an internal nickname.
const aliases = { ronharper:'ronaldharper', vjedgecombe:'valdezedgecombe', nicolasclaxton:'nicclaxton', oganunoby:'oguguaanunoby', alexsarr:'alexandresarr', bubcarrington:'carltoncarrington', svimykhailiuk:'sviatoslavmykhailiuk', santialdama:'santiagoaldama', ggjackson:'gregoryjackson', herbertjones:'herbjones', jalenjohnson:'jalentjohnson' };
const findStats = name => profiles.get(statKey(name)) ?? profiles.get(aliases[statKey(name)]);
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const overall = p => p ? clamp(Math.round(62+((p.ppg+p.rpg*.4+p.apg*.5)*Math.min(p.mpg,38)/38*(.75+.25*Math.min(p.games,60)/60)-2)*(32/28)),62,94) : 62;
function position(p, st) {
  if (['PG','SG','SF','PF','C'].includes(p.position)) return p.position;
  const h=p.heightInches, per36=v=>st?.mpg>0?v/st.mpg*36:0;
  if (p.position==='G') return h<=75||per36(st?.apg??0)>=6?'PG':'SG';
  return h>=82||per36(st?.rpg??0)>=9.5?'PF':'SF';
}
function profile(p) {
  const st=findStats(p.name), ovr=overall(st), age=p.age;
  return { overall:ovr,potential:age>=33?ovr:clamp(ovr+Math.max(0,27-age)+2,ovr,94),age,
    mpg:st?.mpg??6,heightInches:p.heightInches,position:p.position,sourcePlayerId:p.id,estimated:!st,
    seasonStats:{ppg:st?.ppg??0,rpg:st?.rpg??0,apg:st?.apg??0,games:st?.games??0,mpg:st?.mpg??0} };
}
const usedNames=new Set(),usedIds=new Set(),core={},depth={},ratings={},catalog={},excluded=[];
let matched=0,estimated=0,total=0;
for (const [key,abbr] of Object.entries(teams)) {
  const source=JSON.parse(readFileSync(`research/rosters-${SNAPSHOT}/${abbr}.json`,'utf8'));
  if(source.season.year!==2027||source.athletes.length<14)throw Error('Incomplete snapshot: '+abbr);
  const players=source.athletes.map(p=>({...p,position:position(p,findStats(p.name))})).sort((a,b)=>overall(findStats(b.name))-overall(findStats(a.name)) || (b.salary??0)-(a.salary??0) || (b.experience??0)-(a.experience??0) || a.name.localeCompare(b.name));
  // The game has 18 slots. Retain overflow explicitly in the snapshot/report rather than inventing membership.
  excluded.push(...players.slice(18).map(p=>({team:key,...p,reason:'Current 18-player game roster limit'})));
  const roster=players.slice(0,18),parodies=[];
  for(const p of roster) {
    if(usedIds.has(p.id))throw Error('Player appears on multiple current teams: '+p.name);usedIds.add(p.id);
    const id=canonicalName(p.name);
    let alias=registry[id]??toParody(p.name,p.id,p.position);
    alias={firstName:alias.firstName,lastName:typoSurname(p.lastName.normalize('NFD').replace(/\p{M}/gu,'')),position:p.position};
    const nameKey=a=>(a.firstName+' '+a.lastName).toLowerCase();
    if(usedNames.has(nameKey(alias))){const candidates=FIRST_BY_LETTER[p.firstName[0].toUpperCase()]??FIRST_BY_LETTER.A;const first=candidates.find(first=>first.toLowerCase()!==p.firstName.toLowerCase()&&!usedNames.has(nameKey({...alias,firstName:first})));if(!first)throw Error('Name collision: '+p.name);alias.firstName=first;}
    if(canonicalName(alias.firstName)===canonicalName(p.firstName))throw Error('Real first name leaked: '+p.name);
    usedNames.add(nameKey(alias));registry[id]={name:p.name,...alias};parodies.push(alias);
    if(findStats(p.name))matched++;else estimated++;total++;
  }
  core[key]=parodies.slice(0,7);depth[key]=parodies.slice(7);ratings[key]=roster.map(profile);
  while(ratings[key].length<18)ratings[key].push({overall:62,potential:70,age:21,mpg:6,heightInches:78,estimated:true,seasonStats:{ppg:0,rpg:0,apg:0,games:0,mpg:0}});
  catalog[key]=roster.map((p,i)=>({...p,parody:parodies[i],profileSource:findStats(p.name)?findStats(p.name).season+' retained NBA statistics':'development estimate'}));
}
const entries=obj=>Object.entries(obj).map(([key,players])=>`  '${key}': [\n${players.map(p=>`    ${JSON.stringify(p)},`).join('\n')}\n  ],`).join('\n');
for(const [file,data] of [['src/data/parodyRoster.ts',core],['src/data/parodyRosterDepth.ts',depth]]) {
  let text=readFileSync(file,'utf8');const constant=file.endsWith('Depth.ts')?'TEAM_PARODY_DEPTH':'TEAM_PARODY_ROSTERS';
  const regex=new RegExp(`(export const ${constant}: Record<string, ParodyPlayerTemplate\\[\\]> = \\{)[\\s\\S]*?\\n\\};`);
  text=text.replace(regex,`$1\n${entries(data)}\n};`).replace(/Synced from NBA 2025-26 rosters[^\n]*/,`Current 2026-27 rosters from ESPN; snapshot: 6 November 2026.`).replace(/Depth chart parodies — NBA 2025-26 rosters[^\n]*/,`Depth chart parodies — current 2026-27 ESPN roster snapshot: 6 November 2026.`);
  writeFileSync(file,text);
}
writeFileSync('src/data/proballersRatings.ts',`// AUTO-GENERATED by scripts/refresh-current-rosters.mjs.\n// 6 November 2026 team membership/ages/heights; latest available prior NBA season statistics, with explicit estimates for newcomers.\nimport type { PlayerSeasonStats, Position } from '../types/game';\nexport type SlotRating = { overall: number; potential: number; age: number; mpg: number; heightInches: number; seasonStats: PlayerSeasonStats; position?: Position; sourcePlayerId?: string; estimated?: boolean; };\nexport const PROBALLERS_RATINGS: Record<string, SlotRating[]> = {\n${entries(ratings)}\n};\n`);
writeFileSync('scripts/nba-rosters-current.json',JSON.stringify({snapshotDate:SNAPSHOT,season:'2026-27',sources:Object.values(teams).map(abbr=>JSON.parse(readFileSync(`research/rosters-${SNAPSHOT}/${abbr}.json`)).source),teams:catalog,excluded},null,2)+'\n');
writeFileSync('scripts/roster-name-registry.json',JSON.stringify(registry,null,2)+'\n');
console.log(JSON.stringify({teams:Object.keys(core).length,currentPlayers:total,retainedProfiles:matched,developmentEstimates:estimated,overflow:excluded.map(p=>({team:p.team,name:p.name}))},null,2));
