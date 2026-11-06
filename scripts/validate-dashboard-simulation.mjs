/** Sim-to-playoffs must not replay games already played in the current week. */
import { build } from 'esbuild';
const result=await build({stdin:{resolveDir:process.cwd(),contents:`
 import { strict as assert } from 'node:assert';
 import { buildCustomFranchise } from './src/data/scenarios';
 import { createLeague, linkLeagueToFranchise } from './src/data/league';
 import { ensureLeagueRosters } from './src/engine/leagueWorld';
 import { autoStartingFive } from './src/engine/simulation';
 import { useGameStore as store } from './src/store/gameStore';
 function seed(){const base=buildCustomFranchise('Philadelphia','Colonials','Large');const linked=linkLeagueToFranchise(base,createLeague(1,base.city,base.name,82,{wins:0,losses:0},'contend'));const f={...base,...linked.franchise,id:'simulation-test',phase:'regular_season',week:1,gamesThisWeek:0,record:{wins:0,losses:0},gameLog:[],regularSeasonRecord:undefined};f.startingFive=autoStartingFive(f);store.setState({franchise:f,league:ensureLeagueRosters(linked.league,f)});}
 for(const played of [0,1,2]){seed();for(let i=0;i<played;i++)store.getState().playGame();const original=structuredClone(store.getState().franchise.gameLog);store.getState().advanceToPlayoffs();const after=store.getState().franchise;const games=after.gameLog.filter(g=>g.season===after.season);assert.equal(games.length,82,'82 games after starting with '+played);const keys=games.map(g=>g.week+'-'+g.gameInWeek);if(new Set(keys).size!==82)console.log('duplicates',games.filter((g,i)=>keys.indexOf(keys[i])!==i).map(g=>({id:g.id,week:g.week,game:g.gameInWeek,opponent:g.opponent})));assert.equal(new Set(keys).size,82,'unique scheduled games');for(const old of original)assert.deepEqual(games.find(g=>g.id===old.id),old,'existing result changed');assert.equal(after.regularSeasonRecord.wins+after.regularSeasonRecord.losses,82);console.log('PASS sim to playoffs after '+played+' games this week: 82 unique games, existing results preserved');}
 seed();store.getState().playGame();const first=structuredClone(store.getState().franchise.gameLog[0]);store.getState().advanceWeek();const after=store.getState().franchise;assert.equal(after.week,2);assert.equal(after.gamesThisWeek,0);assert.equal(after.gameLog.length,2);assert.deepEqual(after.gameLog.find(g=>g.id===first.id),first);console.log('PASS sim week advances remaining games only');
`},bundle:true,platform:'node',format:'esm',write:false,banner:{js:"Object.defineProperty(globalThis,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},configurable:true});"}});
try{await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}catch(error){console.error(error.message);process.exitCode=1;}
