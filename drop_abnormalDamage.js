/**
 * 異常ダメ検知
 * @version 0.0.4α
 * @author Nishisonic
 */

ComparableArrayType = Java.type("java.lang.Comparable[]");
AppConstants = Java.type("logbook.constants.AppConstants");
AtackKind = Java.type("logbook.dto.AtackKind");
System = Java.type("java.lang.System");
LinkedList = Java.type("java.util.LinkedList");
Arrays = Java.type("java.util.Arrays");
BattleExDto = Java.type("logbook.dto.BattleExDto");
BattlePhaseKind = Java.type("logbook.dto.BattlePhaseKind");
ShipDto = Java.type("logbook.dto.ShipDto");
Collectors = Java.type("java.util.stream.Collectors");
GregorianCalendar = Java.type("java.util.GregorianCalendar");
Paths = Java.type("java.nio.file.Paths");
Files = Java.type("java.nio.file.Files");
StandardOpenOption = Java.type("java.nio.file.StandardOpenOption");
PrintWriter = Java.type("java.io.PrintWriter");
Charset = Java.type("java.nio.charset.Charset");
System = Java.type("java.lang.System");
SimpleDateFormat = Java.type("java.text.SimpleDateFormat");

var FILE_NAME = "AbnormalDamage.log";

var MODE = {
    /** 厳密に測ります。(1ダメでもずれたら検知します) falseにした場合、1ダメージは許容します。 */
    STRICT:true,
    /** 空母のクリティカル砲撃も測るか */
    CV_CL_STRICT:false,
    /** 演習も測るか */
    PLACTICE:false,
    /** うずしおマップも測るか */
    MAELSTROM:false,
    /** 味方からの攻撃に限定するか */
    FRIENDS_ATTACK_ONLY:false,
    /** 敵からの攻撃に限定するか */
    ENEMY_ATTACK_ONLY:false,
};

// 変更禁止
var crlf = System.getProperty("line.separator");
var dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

var MAELSTROM_MAP_LIST = [
    [1,3],
    [3,2],
    [3,3],
    [3,4],
    [4,3],
    [4,4],
    [6,2],
    [22,1],
    [22,3],
    [23,3],
    [24,2],
    [24,4],
    [24,5],
    [25,2],
];

function header() {
    return ["砲撃","雷撃","夜戦"];
}

function begin() {
    iniFile();
}

// 基本的にjavascriptは遅いので注意
// なるべくJavaの型を使って型変換が起こらないようにすべし
// パフォーマンス例
// 56,038件の出撃ログの読み込みにかかった時間(Java 1.8.0_31使用時)
// このスクリプトを使わなかった時: 12,425ms
// javascriptの配列を返した場合: 24,820ms（+12,395ms）
// Javaの配列を返した場合: 14,457ms（+2,032ms）
// javascriptの配列を使うと型変換が必要になってスクリプトの動作速度が5倍以上遅くなる

function body(battle) {
    var result = {
        /** 砲撃戦 */
        hougeki:false,
        /** 雷撃戦 */
        raigeki:false,
        /** 夜戦 */
        yasen:false,
    };
    var ret = new ComparableArrayType(3);
    // -----
    if(battle.getExVersion() >= 2 && !((!MODE.MAELSTROM && !battle.isPractice() && isMaelstromMap(battle)) || (!MODE.PLACTICE && battle.isPractice())) && !isException(battle)){
        var friends = new LinkedList(battle.getDock().getShips());
        for(var i = friends.size();i < 6;i++) friends.add(null);
        if(battle.getDockCombined() != null) friends.addAll(battle.getDockCombined().getShips());
        var enemy = new LinkedList(battle.getEnemy());
        for(var i = enemy.size();i < 6;i++) enemy.add(null);
        if(battle.getEnemyCombined() != null) enemy.addAll(battle.getEnemyCombined());
        var isCombined = battle.isCombined();
        var isEnemyCombined = battle.isEnemyCombined();
        var maxFriendHp = Java.from(battle.getMaxFriendHp()).concat(new Array(6-battle.getMaxFriendHp().length),isCombined ? Java.from(battle.getMaxFriendHpCombined()) : new Array(0));
        var maxEnemyHp = Java.from(battle.getMaxEnemyHp()).concat(new Array(6-battle.getMaxEnemyHp().length),isEnemyCombined ? Java.from(battle.getMaxEnemyHpCombined()) : new Array(0));
        var friendHp = Java.from(battle.getStartFriendHp()).concat(new Array(6-battle.getStartFriendHp().length),isCombined ? Java.from(battle.getStartFriendHpCombined()) : new Array(0));
        var enemyHp = Java.from(battle.getStartEnemyHp()).concat(new Array(6-battle.getStartEnemyHp().length),isEnemyCombined ? Java.from(battle.getStartEnemyHpCombined()) : new Array(0));
        var formationMatch = fromFormationMatch(battle.getFormationMatch());
        var formations = fromFormations(battle.getFormation());
        var friendCombinedKind = battle.isCombined() ? (battle.getCombinedKind() > 0 ? battle.getCombinedKind() : -1) : 0;
        var enemyCombinedKind = battle.isEnemyCombined() ? 1 : 0;
        genDayBattle(battle,result,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind);
        genNightBattle(battle,result,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind);
    }
    ret[0] = result.hougeki ? "？" : "";
    ret[1] = result.raigeki ? "？" : "";
    ret[2] = result.yasen   ? "？" : "";
    return ret;
    /*
    for(var i in battle.getPhaseList()){
        var phase = battle.getPhaseList().get(i);
        phase.isNight() 
    }*/
}

function end() { }

function genNightBattle(battle,result,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind){
    // 夜戦のフェーズを取得
    var nightPhase = battle.getPhaseList().stream().filter(function(phase){
        return phase.isNight();
    }).findFirst().orElse(null);
    if(nightPhase == null) return result;
    // 夜戦
    var yasen = nightPhase.getHougeki();
    if(yasen != null && friendCombinedKind >= 0){
        result.yasen = isAbnormalYasenDamage(yasen,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind,nightPhase.getTouchPlane(),nightPhase.getJson(),battle);
    }
}

// 昼戦処理
function genDayBattle(battle,result,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind){
    // 昼戦のフェーズを取得
    var dayPhase = battle.getPhaseList().stream().filter(function(phase){
        return !phase.isNight();
    }).findFirst().orElse(null);
    if(dayPhase == null) return result;

    var date = battle.getBattleDate();

    // 基地航空隊(噴式)
    var airBaseInjection = dayPhase.getAirBaseInjection();
    if(airBaseInjection != null){
        genAirBattle(airBaseInjection,friendHp,enemyHp);
    }
    // 航空戦(噴式)
    var airInjection = dayPhase.getAirInjection();
    if(airInjection != null){
        genAirBattle(airInjection,friendHp,enemyHp);
    }
    // 基地航空隊
    var airBaseList = dayPhase.getAirBase();
    if(airBaseList != null){
        airBaseList.forEach(function(airBase){
            genAirBattle(airBase,friendHp,enemyHp);
        });
    }
    // 航空戦
    var air = dayPhase.getAir();
    if(air != null){
        genAirBattle(air,friendHp,enemyHp);
    }
    var air2 = dayPhase.getAir2();
    if(air2 != null){
        genAirBattle(air2,friendHp,enemyHp);
    }
    
    // 支援攻撃
    var supportAttack = dayPhase.getSupport();
    if(supportAttack != null){
        genSupportAttack(supportAttack,friendHp,enemyHp);
    }

    var raigekiOrder = getRaigekiOrder(dayPhase.getKind());

    //print(friendCombinedKind,enemyCombinedKind)
    // 先制爆雷
    var openingTaisen = dayPhase.getOpeningTaisen();
    if(openingTaisen != null && friendCombinedKind >= 0){
        isAbnormalHougekiDamage(openingTaisen,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind,date,battle);
    }
    // 開幕雷撃
    var openingRaigeki = dayPhase.getOpening();
    if(openingRaigeki != null && friendCombinedKind >= 0){
        result.raigeki |= isAbnormalRaigekiDamage(openingRaigeki,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind,battle);
    }
    // 砲撃戦
    var hougeki1 = dayPhase.getHougeki1();
    if(hougeki1 != null && friendCombinedKind >= 0){
        result.hougeki |= isAbnormalHougekiDamage(hougeki1,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind,date,battle);
    }
    // 雷撃戦
    var raigeki = dayPhase.getRaigeki();
    if(raigeki != null && friendCombinedKind >= 0 && raigekiOrder == 1){
        result.raigeki |= isAbnormalRaigekiDamage(raigeki,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind,battle);
    }
    var hougeki2 = dayPhase.getHougeki2();
    if(hougeki2 != null && friendCombinedKind >= 0){
        result.hougeki |= isAbnormalHougekiDamage(hougeki2,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind,date,battle);
    }
    if(raigeki != null && friendCombinedKind >= 0 && raigekiOrder == 2){
        result.raigeki |= isAbnormalRaigekiDamage(raigeki,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind,battle);
    }
    var hougeki3 = dayPhase.getHougeki3();
    if(hougeki3 != null && friendCombinedKind >= 0){
        result.hougeki |= isAbnormalHougekiDamage(hougeki3,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind,date,battle);
    }
    if(raigeki != null && friendCombinedKind >= 0 && raigekiOrder == -1){
        result.raigeki |= isAbnormalRaigekiDamage(raigeki,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedKind,enemyCombinedKind,battle);
    }
}

/**
 * 雷撃異常ダメージを検知します。
 * 
 * @param {*} atacks 
 * @param {*} friends 
 * @param {*} enemy 
 * @param {*} maxFriendHp 
 * @param {*} maxEnemyHp 
 * @param {*} friendHp 
 * @param {*} enemyHp 
 * @param {*} formationMatch 
 * @param {*} formations 
 * @param {*} friendCombinedKind 
 * @param {*} enemyCombinedKind 
 */
function isAbnormalRaigekiDamage(atacks,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedType,enemyCombinedType,battle){
    var _isAbnormalRaigekiDamage = function(origin,target,targetIdx,targetHp,damage,formationMatch,formation,friendCombinedKind,enemyCombinedKind,isFriend,maxOriginHp,nowOriginHp,critical){
        if((isFriend ? MODE.ENEMY_ATTACK_ONLY : MODE.FRIENDS_ATTACK_ONLY)) return false;
        var raigekiPower = getRaigekiPower(origin,target,formationMatch,formation,friendCombinedKind,enemyCombinedKind,isFriend,maxOriginHp,nowOriginHp);
        var finalRaigekiPower = Math.floor(Math.floor(raigekiPower) * (isCritical(critical) ? getCriticalBonus(critical) : 1.0));
        var minDefensePower = target.soukou * 0.7;
        var maxDefensePower = target.soukou * 1.3 - 0.6;
        var minDmg = Math.floor((finalRaigekiPower - maxDefensePower) * getAmmoBonus(origin,isFriend));
        var maxDmg = Math.floor((finalRaigekiPower - minDefensePower) * getAmmoBonus(origin,isFriend));
        var minPropDmg = Math.floor(targetHp * 0.06);
        var maxPropDmg = Math.floor(targetHp * 0.14 - 0.08);
        var minSunkDmg = Math.floor(targetHp * 0.5);
        var maxSunkDmg = Math.floor(targetHp * 0.8 - 0.3);
        var isHp1Obj = (targetHp - damage == 1) && isHp1ReplacementObj(target,targetIdx);
        
        var _isAbnormalDamage = isAbnormalDamage(damage,minDmg,maxDmg,minPropDmg,maxPropDmg,targetHp,minSunkDmg,maxSunkDmg,isFriend,isHp1Obj);
        if(_isAbnormalDamage){
            var writeData = "";
            writeData += "日付:" + dateFormat.format(battle.getBattleDate()) + crlf;
            writeData += "戦闘場所:" + (battle.isPractice() ? "演習" : (battle.getMapCellDto().getMap()[0] + "-" + battle.getMapCellDto().getMap()[1] + "-" + battle.getMapCellDto().getMap()[2])) + crlf;
            writeData += "艦隊:味方->" + toFriendCombinedKindString(friendCombinedKind) + " 敵->" + toEnemyCombinedKindString(enemyCombinedKind) + " 連合艦隊補正:" + getCombinedRaigekiPoewrBonus(friendCombinedKind,enemyCombinedKind,isFriend) + crlf;
            writeData += "交戦形態:" + toFormationMatchString(formationMatch) + " 自陣形:" + toFormationString(formation) + crlf;
            var oItem2 = new LinkedList(origin.item2);
            if(origin instanceof ShipDto) oItem2.add(origin.slotExItem);
            var tItem2 = new LinkedList(target.item2);
            if(target instanceof ShipDto) tItem2.add(target.slotExItem);
            writeData += "雷撃:" + origin.fullName + "[雷装(装備含):" + origin.raisou + ",改修火力:" + getRaigekiKaishuPower(oItem2).toFixed(1) + "] -> " + target.fullName + "[装甲(装備含):" + target.soukou + ",HP:" + targetHp + "-" + damage + "=>" + (targetHp-damage) + "]" + crlf;
            writeData += "攻撃->" + ('000' + origin.shipId).slice(-3) + ":" + origin.fullName + crlf;
            writeData += toItemString(oItem2) + crlf;
            writeData += "防御->" + ('000' + target.shipId).slice(-3) + ":" + target.fullName + crlf;
            writeData += toItemString(tItem2) + crlf;
            writeData += "耐久:" + nowOriginHp + " / " + maxOriginHp + " (" + toHPStateString(maxOriginHp,nowOriginHp) + ",x" + getHPPowerBonus(maxOriginHp,nowOriginHp,false).toFixed(1) + ") 弾薬:" + (isFriend ? (origin.bull + " / " + origin.bullMax + " (" + (origin.bull / origin.bullMax * 100).toFixed() + "%,x" + getAmmoBonus(origin,isFriend).toFixed(1) + ")") : "? / ? (100%,x" + getAmmoBonus(origin,isFriend).toFixed(1) + ")") + crlf;
            writeData += "クリティカル:" + (isCritical ? "あり(x1.5)" : "なし(x1.0)") + crlf;
            writeData += "雷撃火力:" + raigekiPower.toFixed(1) + " 最終雷撃火力:" + finalRaigekiPower.toFixed(1) + crlf;
            writeData += "防御力範囲:" + minDefensePower.toFixed(1) + " - " + maxDefensePower.toFixed(1) + crlf;
            writeData += "想定通常dmg:" + minDmg + " - " + maxDmg + crlf;
            writeData += "想定割合dmg:" + minPropDmg + " - " + maxPropDmg + crlf;
            writeData += "想定轟スdmg:" + minSunkDmg + " - " + maxSunkDmg + crlf;
            writeData += "HP1置き換え:" + "残HP->" + (targetHp - damage) + crlf;
            write(writeData);
        }
        return _isAbnormalDamage;
    }

    var atackList = atacks.stream().collect(Collectors.partitioningBy(function(atack){return atack.friendAtack; }));
    var tmpFriendHp = friendHp.concat();
    var tmpEnemyHp = enemyHp.concat();
    // フレンズ
    var isFriendAbnormalDamage = function(){
        var result = false;
        for(var i = 0;i < atackList.get(true).size();i++){
            var atack = atackList.get(true).get(i);
            var origins = friends;
            var maxOriginHp = maxFriendHp;
            var nowOriginHp = friendHp;
            var targets = enemy;
            var targetHp = tmpEnemyHp;
            var formation = formations[0];
            for(var j = 0;j < atack.ot.length;j++){
                var x = atack.ot[j];
                var originIdx = atack.origin[j];
                var targetIdx = atack.target[x];
                var origin = origins.get(originIdx);
                var target = targets.get(targetIdx);
                var critical = atack.critical != null ? atack.critical[j] : 0;
                result |= _isAbnormalRaigekiDamage(
                    origin,
                    target,
                    targetIdx,
                    targetHp[targetIdx],
                    atack.ydam[j],
                    formationMatch,
                    formation,
                    toCombinedKind(friendCombinedType,originIdx),
                    toCombinedKind(enemyCombinedType,targetIdx),
                    true,
                    maxOriginHp[originIdx],
                    nowOriginHp[originIdx],
                    critical);
                targetHp[targetIdx] -= atack.ydam[j];
            }
        }
        return result;
    }();
    // セルリアン
    var isEnemyAbnormalDamage = function(){
        var result = false;
        for(var i = 0;i < atackList.get(false).size();i++){
            var atack = atackList.get(false).get(i);
            var origins = enemy;
            var maxOriginHp = maxEnemyHp;
            var nowOriginHp = enemyHp;
            var targets = friends;
            var targetHp = tmpFriendHp;
            var formation = formations[1];
            for(var j = 0;j < atack.ot.length;j++){
                var x = atack.ot[j];
                var originIdx = atack.origin[j];
                var targetIdx = atack.target[x];
                var origin = origins.get(originIdx);
                var target = targets.get(targetIdx);
                var critical = atack.critical != null ? atack.critical[j] : 0;
                result |= _isAbnormalRaigekiDamage(
                    origin,
                    target,
                    targetIdx,
                    targetHp[targetIdx],
                    atack.ydam[j],
                    formationMatch,
                    formation,
                    toCombinedKind(friendCombinedType,targetIdx),
                    toCombinedKind(enemyCombinedType,originIdx),
                    false,
                    maxOriginHp[originIdx],
                    nowOriginHp[originIdx],
                    critical);
                targetHp[targetIdx] -= atack.ydam[j];
            }
        }
        return result;
    }();
    // ダメージ処理
    atacks.forEach(function(atack){
        var targetHp;
        if(atack.friendAtack){
            targetHp = enemyHp;
        } else {
            targetHp = friendHp;
        }
        Java.from(atack.ot).forEach(function(x,i,a){
            var targetIdx = atack.target[x];
            targetHp[targetIdx] -= atack.ydam[i];
        });
    });
    // フレンズ
    for(var targetIdx = 0;targetIdx < friendHp.length;targetIdx++){
        if(friendHp[targetIdx] <= 0){
            var target = friends.get(targetIdx);
            for(var k = 0;k < target.item2.size();k++){
                var item = target.item2.get(k);
                if(item != null){
                    var slotitemId = item.slotitemId;
                    if(slotitemId == 43){
                        // 応急修理要員
                        friendHp[targetIdx] = Math.floor(maxFriendHp[targetIdx] * 0.2);
                        break;
                    } else if(slotitemId == 44){
                        // 応急修理女神
                        friendHp[targetIdx] = maxFriendHp[targetIdx];
                        break;
                    }
                }
            }
        }
    }
    // セルリアン
    for(var targetIdx = 0;targetIdx < enemyHp.length;targetIdx++){
        if(enemyHp[targetIdx] <= 0){
            var target = enemy.get(targetIdx);
            for(var k = 0;k < target.item2.size();k++){
                var item = target.item2.get(k);
                if(item != null){
                    var slotitemId = item.slotitemId;
                    if(slotitemId == 43){
                        // 応急修理要員
                        enemyHp[targetIdx] = Math.floor(maxEnemyHp[targetIdx] * 0.2);
                        break;
                    } else if(slotitemId == 44){
                        // 応急修理女神
                        enemyHp[targetIdx] = maxEnemyHp[targetIdx];
                        break;
                    }
                }
            }
        }
    }
    return isFriendAbnormalDamage || isEnemyAbnormalDamage;
}

/**
 * 
 * @param {java.util.List<BattleAtackDto>} atacks 
 * @param {java.util.List<ShipDto>} friends 
 * @param {java.util.List<EnemyShipDto>} enemy 
 * @param {Number[]} maxFriendHp 
 * @param {Number[]} maxEnemyHp 
 * @param {Number[]} friendHp 
 * @param {Number[]} enemyHp 
 * @param {Boolean} isOpening 
 * @param {Number[]} formationMatch 
 * @param {Number[]} formations 
 * @param {Number} friendCombinedKind 
 * @param {Number} enemyCombinedKind 
 */
function isAbnormalHougekiDamage(atacks,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedType,enemyCombinedType,date,battle){
    var _isAbnormalHougekiDamage = function(origin,target,targetIdx,targetHp,damage,hougekiType,formationMatch,formation,friendCombinedKind,enemyCombinedKind,isFriend,maxOriginHp,nowOriginHp,critical,date){
        var stype = target.getStype();
        // 対潜攻撃
         if(stype == 13 || stype == 14 || (getHougekiKind(origin) == 7 && isCritical(critical) && !MODE.CV_CL_STRICT) || (isFriend ? MODE.ENEMY_ATTACK_ONLY : MODE.FRIENDS_ATTACK_ONLY)) return false;
        // 砲撃
        var hougekiPower = getHougekiPower(origin,target,formationMatch,formation,friendCombinedKind,enemyCombinedKind,isFriend,maxOriginHp,nowOriginHp,date);
        var minFinalHougekiPower = Math.floor(Math.floor(Math.floor(hougekiPower * getShusekiBonus(origin,target)) * getAPshellBonus(origin,target)) * (isCritical(critical) ? (getCriticalBonus(critical) * getSkilledBonus(origin,true)) : 1.0)) * getStrikingBonus(hougekiType) * getPtBonus(origin,target);
        var maxFinalHougekiPower = Math.floor(Math.floor(Math.floor(hougekiPower * getShusekiBonus(origin,target)) * getAPshellBonus(origin,target)) * (isCritical(critical) ? (getCriticalBonus(critical) * getSkilledBonus(origin,false)) : 1.0)) * getStrikingBonus(hougekiType) * getPtBonus(origin,target);
        var minDefensePower = target.soukou * 0.7;
        var maxDefensePower = target.soukou * 1.3 - 0.6;
        var minDmg = Math.floor((minFinalHougekiPower - maxDefensePower) * getAmmoBonus(origin,isFriend));
        var maxDmg = Math.floor((maxFinalHougekiPower - minDefensePower) * getAmmoBonus(origin,isFriend));
        var minPropDmg = Math.floor(targetHp * 0.06);
        var maxPropDmg = Math.floor(targetHp * 0.14 - 0.08);
        var minSunkDmg = Math.floor(targetHp * 0.5);
        var maxSunkDmg = Math.floor(targetHp * 0.8 - 0.3);
        var isHp1Obj = (targetHp - damage == 1) && isHp1ReplacementObj(target,targetIdx);

        var _isAbnormalDamage = isAbnormalDamage(damage,minDmg,maxDmg,minPropDmg,maxPropDmg,targetHp,minSunkDmg,maxSunkDmg,isFriend,isHp1Obj);
        if(_isAbnormalDamage){
            var writeData = "";
            writeData += "日付:" + dateFormat.format(battle.getBattleDate()) + crlf;
            writeData += "戦闘場所:" + (battle.isPractice() ? "演習" : (battle.getMapCellDto().getMap()[0] + "-" + battle.getMapCellDto().getMap()[1] + "-" + battle.getMapCellDto().getMap()[2])) + crlf;
            writeData += "艦隊:味方->" + toFriendCombinedKindString(friendCombinedKind) + " 敵->" + toEnemyCombinedKindString(enemyCombinedKind) + " 連合艦隊補正:" + getCombinedHougekiPoewrBonus(friendCombinedKind,enemyCombinedKind,isFriend) + crlf;
            writeData += "交戦形態:" + toFormationMatchString(formationMatch) + " 自陣形:" + toFormationString(formation) + crlf;
            var oItem2 = new LinkedList(origin.item2);
            if(origin instanceof ShipDto) oItem2.add(origin.slotExItem);
            var tItem2 = new LinkedList(target.item2);
            if(target instanceof ShipDto) tItem2.add(target.slotExItem);
            writeData += "砲撃:" + origin.fullName + "[火力(装備含):" + origin.karyoku + ",改修火力:" + getHougekiKaishuPower(oItem2).toFixed(1) + ",空母用->雷装:" + origin.slotParam.raig + ",爆装:" + origin.slotParam.baku + "] -> " + target.fullName + "[装甲(装備含):" + target.soukou + ",HP:" + targetHp + "-" + damage + "=>" + (targetHp-damage) + "]" + crlf;
            writeData += "攻撃->" + ('000' + origin.shipId).slice(-3) + ":" + origin.fullName + crlf;
            writeData += toItemString(oItem2) + crlf;
            writeData += "防御->" + ('000' + target.shipId).slice(-3) + ":" + target.fullName + crlf;
            writeData += toItemString(tItem2) + crlf;
            writeData += "耐久:" + nowOriginHp + " / " + maxOriginHp + " (" + toHPStateString(maxOriginHp,nowOriginHp) + ",x" + getHPPowerBonus(maxOriginHp,nowOriginHp,false).toFixed(1) + ") 弾薬:" + (isFriend ? (origin.bull + " / " + origin.bullMax + " (" + (origin.bull / origin.bullMax * 100).toFixed() + "%,x" + getAmmoBonus(origin,isFriend).toFixed(1) + ")") : "? / ? (100%,x" + getAmmoBonus(origin,isFriend).toFixed(1) + ")") + crlf;
            writeData += "陸上特効:x" + getLandBonus(origin,target).toFixed(1) + " WG42加算特効:+" + getWGBonus(origin,target) + " 軽巡軽量砲補正:+" + getCLLightGunPowerBonus(origin).toFixed(1) + crlf;
            writeData += "集積地特効:x" + getShusekiBonus(origin,target).toFixed(1) + " 徹甲弾補正:x" + getAPshellBonus(origin,target).toFixed(2) + " PT小鬼補正:x" + getPtBonus(origin,target).toFixed(1) + crlf;
            writeData += "砲撃攻撃種別:" + toStrikingKindString(hougekiType) + crlf;
            writeData += "クリティカル:" + (isCritical ? "あり(x1.5)" : "なし(x1.0)") + crlf;
            writeData += "熟練度倍率:x" + getSkilledBonus(origin,false).toFixed(1) + " - x" + getSkilledBonus(origin,true).toFixed(1) + crlf;
            writeData += "砲撃火力:" + hougekiPower.toFixed(1) + " 最終砲撃火力:" + minFinalHougekiPower.toFixed(1) + " - " + maxFinalHougekiPower.toFixed(1) + crlf;
            writeData += "防御力範囲:" + minDefensePower.toFixed(1) + " - " + maxDefensePower.toFixed(1) + crlf;
            writeData += "想定通常dmg:" + minDmg + " - " + maxDmg + crlf;
            writeData += "想定割合dmg:" + minPropDmg + " - " + maxPropDmg + crlf;
            writeData += "想定轟スdmg:" + minSunkDmg + " - " + maxSunkDmg + crlf;
            writeData += "HP1置き換え:" + "残HP->" + (targetHp - damage) + crlf;
            write(writeData);
        }
        return _isAbnormalDamage;

    };
    var _isAbnormalDamage = false;
    for(var i = 0;i < atacks.size();i++){
        var atack = atacks.get(i);
        var isFriend = atack.friendAtack;
        var origin;
        var originIdx = atack.origin[0];
        var maxOriginHp;
        var nowOriginHp;
        var target;
        var targetHp;
        var targetIdx = atack.target[0];
        var isTouch;
        if(atack.friendAtack){
            origin = friends.get(originIdx);
            maxOriginHp = maxFriendHp[originIdx];
            nowOriginHp = friendHp[originIdx];
            target = enemy.get(targetIdx);
            targetHp = enemyHp;
        }
        else {
            origin = enemy.get(originIdx);
            maxOriginHp = maxEnemyHp[originIdx];
            nowOriginHp = enemyHp[originIdx];
            target = friends.get(targetIdx);
            targetHp = friendHp;
        }
        
        for(var j = 0;j < atack.damage.length;j++){
            _isAbnormalDamage |= _isAbnormalHougekiDamage(
                origin,
                target,
                targetIdx,
                targetHp[targetIdx],
                atack.damage[j],
                atack.type,
                formationMatch,
                formations[isFriend ? 0 : 1],
                toCombinedKind(friendCombinedType,isFriend ? originIdx : targetIdx),
                toCombinedKind(enemyCombinedType,!isFriend ? originIdx : targetIdx),
                isFriend,
                maxOriginHp,
                nowOriginHp,
                atack.critical != null ? atack.critical[j] : 0,
                date);
            // ダメージ処理
            targetHp[targetIdx] -= atack.damage[j];
        }
        if(targetHp[targetIdx] <= 0){
            for(var k = 0;k < target.item2.size();k++){
                var item = target.item2.get(k);
                if(item != null){
                    var slotitemId = item.slotitemId;
                    if(slotitemId == 43){
                        // 応急修理要員
                        targetHp[targetIdx] = Math.floor(maxFriendHp[targetIdx] * 0.2);
                        break;
                    } else if(slotitemId == 44){
                        // 応急修理女神
                        targetHp[targetIdx] = maxFriendHp[targetIdx];
                        break;
                    }
                }
            }
        }
    }
    return _isAbnormalDamage;
}

function isAbnormalYasenDamage(atacks,friends,enemy,maxFriendHp,maxEnemyHp,friendHp,enemyHp,formationMatch,formations,friendCombinedType,enemyCombinedType,touchPlane,json,battle){
    var _isAbnormalYasenDamage = function(origin,target,targetIdx,targetHp,damage,formationMatch,formation,friendCombinedKind,enemyCombinedKind,isFriend,maxOriginHp,nowOriginHp,critical,isTouch,spAttack){
        var stype = target.getStype();
        // 対潜攻撃
         if(stype == 13 || stype == 14 || (isFriend ? MODE.ENEMY_ATTACK_ONLY : MODE.FRIENDS_ATTACK_ONLY)) return false;
        // 砲撃
        //print("夜戦",origin.fullName,target.fullName,targetHp+"-"+damage+"=>"+(targetHp-damage));
        var yasenPower = getYasenPower(origin,target,formationMatch,formation,friendCombinedKind,enemyCombinedKind,isFriend,maxOriginHp,nowOriginHp,isTouch,spAttack);
        var finalYasenPower = Math.floor(Math.floor(yasenPower * getShusekiBonus(origin,target))) * (isCritical(critical) ? getCriticalBonus(critical) : 1.0) * getPtBonus(origin,target);
        var minDefensePower = target.soukou * 0.7;
        var maxDefensePower = target.soukou * 1.3 - 0.6;
        var minDmg = Math.floor((finalYasenPower - maxDefensePower) * getAmmoBonus(origin,isFriend));
        var maxDmg = Math.floor((finalYasenPower - minDefensePower) * getAmmoBonus(origin,isFriend));
        var minPropDmg = Math.floor(targetHp * 0.06);
        var maxPropDmg = Math.floor(targetHp * 0.14 - 0.08);
        var minSunkDmg = Math.floor(targetHp * 0.5);
        var maxSunkDmg = Math.floor(targetHp * 0.8 - 0.3);
        var isHp1Obj = (targetHp - damage == 1) && isHp1ReplacementObj(target,targetIdx);
        
        var _isAbnormalDamage = isAbnormalDamage(damage,minDmg,maxDmg,minPropDmg,maxPropDmg,targetHp,minSunkDmg,maxSunkDmg,isFriend,isHp1Obj);
        if(_isAbnormalDamage){
            var writeData = "";
            writeData += "日付:" + dateFormat.format(battle.getBattleDate()) + crlf;
            writeData += "戦闘場所:" + (battle.isPractice() ? "演習" : (battle.getMapCellDto().getMap()[0] + "-" + battle.getMapCellDto().getMap()[1] + "-" + battle.getMapCellDto().getMap()[2])) + crlf;
            writeData += "艦隊:味方->" + toFriendCombinedKindString(friendCombinedKind) + " 敵->" + toEnemyCombinedKindString(enemyCombinedKind) + crlf;
            writeData += "交戦形態:" + toFormationMatchString(formationMatch) + " 自陣形:" + toFormationString(formation) + crlf;
            var oItem2 = new LinkedList(origin.item2);
            if(origin instanceof ShipDto) oItem2.add(origin.slotExItem);
            var tItem2 = new LinkedList(target.item2);
            if(target instanceof ShipDto) tItem2.add(target.slotExItem);
            writeData += "夜戦:" + origin.fullName + "[火力(装備含):" + origin.karyoku + ",雷装(装備含):" + origin.raisou + ",改修火力:" + getYasenKaishuPower(oItem2).toFixed(1) + "] -> " + target.fullName + "[装甲(装備含):" + target.soukou + ",HP:" + targetHp + "-" + damage + "=>" + (targetHp-damage) + "]" + crlf;
            writeData += "攻撃->" + ('000' + origin.shipId).slice(-3) + ":" + origin.fullName + crlf;
            writeData += toItemString(oItem2) + crlf;
            writeData += "防御->" + ('000' + target.shipId).slice(-3) + ":" + target.fullName + crlf;
            writeData += toItemString(tItem2) + crlf;
            writeData += "耐久:" + nowOriginHp + " / " + maxOriginHp + " (" + toHPStateString(maxOriginHp,nowOriginHp) + ",x" + getHPPowerBonus(maxOriginHp,nowOriginHp,false).toFixed(1) + ") 弾薬:" + (isFriend ? (origin.bull + " / " + origin.bullMax + " (" + (origin.bull / origin.bullMax * 100).toFixed() + "%,x" + getAmmoBonus(origin,isFriend).toFixed(1) + ")") : "? / ? (100%,x" + getAmmoBonus(origin,isFriend).toFixed(1) + ")") + crlf;
            writeData += "陸上特効:x" + getLandBonus(origin,target).toFixed(1) + " WG42加算特効:+" + getWGBonus(origin,target) + " 軽巡軽量砲補正:+" + getCLLightGunPowerBonus(origin).toFixed(1) + crlf;
            writeData += "集積地特効:x" + getShusekiBonus(origin,target).toFixed(1) + " PT小鬼補正:x" + getPtBonus(origin,target).toFixed(1) + crlf;
            writeData += "夜戦攻撃種別:" + toSpAttackKindString(origin,spAttack) + crlf;
            writeData += "クリティカル:" + (isCritical ? "あり(x1.5)" : "なし(x1.0)") + crlf;
            writeData += "夜戦火力:" + yasenPower.toFixed(1) + " 最終夜戦火力:" + finalYasenPower.toFixed(1) + crlf;
            writeData += "防御力範囲:" + minDefensePower.toFixed(1) + " - " + maxDefensePower.toFixed(1) + crlf;
            writeData += "想定通常dmg:" + minDmg + " - " + maxDmg + crlf;
            writeData += "想定割合dmg:" + minPropDmg + " - " + maxPropDmg + crlf;
            writeData += "想定轟スdmg:" + minSunkDmg + " - " + maxSunkDmg + crlf;
            writeData += "HP1置き換え:" + "残HP->" + (targetHp - damage) + crlf;
            write(writeData);
        }
        return  _isAbnormalDamage;
    };
    //print(json.api_hougeki.api_at_list)
    //print(json.api_hougeki.api_sp_list)
    var _isAbnormalDamage = false;
    for(var i = 0;i < atacks.size();i++){
        var atack = atacks.get(i);
        // api_active_deck[1,1]
        var isFriend = atack.friendAtack;
        var origin;
        var originIdx = atack.origin[0];
        var maxOriginHp;
        var nowOriginHp;
        var target;
        var targetHp;
        var targetIdx = atack.target[0];
        var isTouch;
        var spAttack = function(idx){
            for(var j = 0;j < json.api_hougeki.api_at_list.length;j++){
                if(json.api_hougeki.api_at_list[j] == (idx % 6) + (isFriend ? 0 : 6) + 1){
                    return json.api_hougeki.api_sp_list[j];
                }
            }
            return 0;
        }(originIdx);
        if(atack.friendAtack){
            origin = friends.get(originIdx);
            maxOriginHp = maxFriendHp[originIdx];
            nowOriginHp = friendHp[originIdx];
            target = enemy.get(targetIdx);
            targetHp = enemyHp;
            isTouch = touchPlane[0] != -1;
        }
        else {
            origin = enemy.get(originIdx);
            maxOriginHp = maxEnemyHp[originIdx];
            nowOriginHp = enemyHp[originIdx];
            target = friends.get(targetIdx);
            targetHp = friendHp;
            isTouch = touchPlane[1] != -1;
        }
        //print(origin.fullName,target.fullName,atack.target.length," spAttack:",spAttack)
        for(var j = 0;j < atack.damage.length;j++){
            _isAbnormalDamage |= _isAbnormalYasenDamage(
                origin,
                target,
                targetIdx,
                targetHp[targetIdx],
                atack.damage[j],
                formationMatch,
                formations[isFriend ? 0 : 1],
                toCombinedKind(friendCombinedType,isFriend ? originIdx : targetIdx),
                toCombinedKind(enemyCombinedType,!isFriend ? originIdx : targetIdx),
                isFriend,
                maxOriginHp,
                nowOriginHp,
                atack.critical != null ? atack.critical[j] : 0,
                isTouch,
                spAttack);
            // ダメージ処理
            targetHp[targetIdx] -= atack.damage[j];
        }
        if(targetHp[targetIdx] <= 0){
            for(var k = 0;k < target.item2.size();k++){
                var item = target.item2.get(k);
                if(item != null){
                    var slotitemId = item.slotitemId;
                    if(slotitemId == 43){
                        // 応急修理要員
                        targetHp[targetIdx] = Math.floor(maxFriendHp[targetIdx] * 0.2);
                        break;
                    } else if(slotitemId == 44){
                        // 応急修理女神
                        targetHp[targetIdx] = maxFriendHp[targetIdx];
                        break;
                    }
                }
            }
        }
    }
    return _isAbnormalDamage;
}

/**
 * キャップ後砲撃戦火力を返します。
 * 
 * キャップ前攻撃力 = ((基本攻撃力*a12+b12)*陸上特効*a13+WG42加算特効+b13)*交戦形態補正*攻撃側陣形補正*夜戦特殊攻撃補正*損傷状態補正*対潜シナジー補正*a14+軽巡軽量砲補正+b14
 * キャップ後攻撃力 = min(キャップ値,キャップ値+√(キャップ前攻撃力-キャップ値))
 * 
 * @param {logbook.dto.ShipDto} ship 艦娘のデータ
 * @param {logbook.dto.EnemyShipDto} target 敵艦のデータ
 * @param {Number} formationMatch 交戦形態
 * @param {Number} formation 攻撃側陣形補正
 * @param {Number} friendCombinedKind 自軍連合艦隊の種別(0なら通常艦隊)
 * @param {Number} enemyCombinedKind 敵軍連合艦隊の種別(0なら通常艦隊)
 * @param {Boolean} isFriend 攻撃が味方側か
 * @return {Number} 砲撃戦火力
 */
function getHougekiPower(origin,target,formationMatch,formation,friendCombinedKind,enemyCombinedKind,isFriend,maxOriginHp,nowOriginHp,date){
    var CHANGE_CAP_DATE = new GregorianCalendar(2017, 3 - 1, 17, 17, 30, 0).getTime();
    // 基本攻撃力
    var basicPower;
    var item2 = new LinkedList(origin.item2);
    if(origin instanceof ShipDto) item2.add(origin.slotExItem);
    switch(getHougekiKind(origin)){
        case 7:
            var rai = target.param.soku > 0 ? origin.slotParam.raig : 0;
            var baku = target.param.soku > 0 ? origin.slotParam.baku : 0;
            // 空母系:[(火力+雷装+[1.3*爆装]+装備改修補正+連合艦隊補正)*1.5]+55
            basicPower = Math.floor((origin.karyoku + rai + Math.floor(baku * 1.3) + getHougekiKaishuPower(item2) + getCombinedHougekiPoewrBonus(friendCombinedKind,enemyCombinedKind,isFriend)) * 1.5) + 55;
            break;
        default:
            // それ以外:火力+装備改修補正+連合艦隊補正+5
            basicPower = (origin.karyoku + getHougekiKaishuPower(item2) + getCombinedHougekiPoewrBonus(friendCombinedKind,enemyCombinedKind,isFriend) + 5);
            break;
    }
    // キャップ前攻撃力 = (基本攻撃力*陸上特効+WG42加算特効)*交戦形態補正*攻撃側陣形補正*損傷状態補正+軽巡軽量砲補正
    var power = (basicPower * getLandBonus(origin,target) + getWGBonus(origin,target)) * getFormationMatchBonus(formationMatch) * getFormationBonus(formation) * getHPPowerBonus(maxOriginHp,nowOriginHp,false) + getCLLightGunPowerBonus(origin);
    var cap = CHANGE_CAP_DATE.compareTo(date) < 0 ? 180 : 150;
    // キャップ後攻撃力 = min(キャップ値,キャップ値+√(キャップ前攻撃力-キャップ値))
    return softcap(power,cap);
}

/**
 * 夜戦火力を返します。
 * 
 * @param {logbook.dto.ShipDto} ship 艦娘のデータ
 * @return {Number} 夜戦火力
 */
function getYasenPower(origin,target,formationMatch,formation,friendCombinedKind,enemyCombinedKind,isFriend,maxOriginHp,nowOriginHp,isTouch,spAttack){
    var item2 = new LinkedList(origin.item2);
    if(origin instanceof ShipDto) item2.add(origin.slotExItem);
    var basicPower = (origin.karyoku + (target.param.soku > 0 ? origin.raisou : 0)) + getYasenKaishuPower(item2) + (isTouch ? 5 : 0);
    var yasenPower = (basicPower * getLandBonus(origin,target) + getWGBonus(origin,target)) * getYasenCutinBonus(origin,spAttack) * getHPPowerBonus(maxOriginHp,nowOriginHp,false) + getCLLightGunPowerBonus(origin);
    return softcap(yasenPower,300);
}

/**
 * 
 * @param {*} origin 
 * @param {*} target 
 * @param {*} formationMatch 
 * @param {*} formation 
 * @param {*} friendCombinedKind 
 * @param {*} enemyCombinedKind 
 * @param {*} isFriend 
 * @param {*} maxOriginHp 
 * @param {*} nowOriginHp 
 */
function getRaigekiPower(origin,target,formationMatch,formation,friendCombinedKind,enemyCombinedKind,isFriend,maxOriginHp,nowOriginHp){
    var item2 = new LinkedList(origin.item2);
    if(origin instanceof ShipDto) item2.add(origin.slotExItem);
    var basicPower = origin.raisou + getRaigekiKaishuPower(item2) + getCombinedRaigekiPoewrBonus(friendCombinedKind,enemyCombinedKind,isFriend) + 5;
    var raigekiPower = basicPower * getFormationMatchBonus(formationMatch) * getFormationBonus(formation,true) * getHPPowerBonus(maxOriginHp,nowOriginHp,true);
    return softcap(raigekiPower,150);
}

/**
 * 砲撃戦改修補正火力を返します。
 * 
 * @param {logbook.dto.ItemDto} item2 装備データ
 * @return {Number} 改修補正火力
 */
function getHougekiKaishuPower(item2){
    var kaishuBonus = function(type2){
        switch(type2){
            case 1: return 1;    // 小口径主砲
            case 2: return 1;    // 中口径主砲
            case 3: return 1.5;  // 大口径主砲
            case 38:return 1.5;  // 大口径主砲(II)
            case 4: return 1;    // 副砲
            case 19:return 1;    // 対艦強化弾
            case 36:return 1;    // 高射装置
            case 29:return 1;    // 探照灯
            case 42:return 1;    // 大型探照灯
            case 21:return 1;    // 機銃
            case 15:return 0.75; // 爆雷
            case 14:return 0.75; // ソナー
            case 40:return 0.75; // 大型ソナー
            case 24:return 1;    // 上陸用舟艇
            case 46:return 1;    // 特二式内火艇
            default:return 0;
        }
    };
    return item2.stream().filter(function(item){
        return item != null;
    }).mapToDouble(function(item){
        return kaishuBonus(item.type2) * Math.sqrt(item.level);
    }).sum();
}

/**
 * 夜戦改修補正火力を返します。
 * 
 * @param {logbook.dto.ItemDto} item2 装備データ
 * @return {Number} 改修補正火力
 */
function getYasenKaishuPower(item2){
    var kaishuBonus = function(type2){
        switch(type2){
            case 1: return 1;    // 小口径主砲
            case 2: return 1;    // 中口径主砲
            case 3: return 1;    // 大口径主砲
            case 38:return 1.5;  // 大口径主砲(II)
            case 4: return 1;    // 副砲
            case 19:return 1;    // 対艦強化弾
            case 36:return 1;    // 高射装置
            case 29:return 1;    // 探照灯
            case 42:return 1;    // 大型探照灯
            case  5:return 1;    // 魚雷
            case 32:return 1;    // 潜水艦魚雷
            case 24:return 1;    // 上陸用舟艇
            case 46:return 1;    // 特二式内火艇
            default:return 0;
        }
    };
    return item2.stream().filter(function(item){
        return item != null;
    }).mapToDouble(function(item){
        return kaishuBonus(item.type2) * Math.sqrt(item.level);
    }).sum();
}

/**
 * 雷撃戦改修補正火力を返します。
 * 
 * @param {logbook.dto.ItemDto} item2 装備データ
 * @return {Number} 改修補正火力
 */
function getRaigekiKaishuPower(item2){
    return item2.stream().filter(function(item){ return item != null && (item.type2 === 5 || item.type2 === 21 || item.type2 === 32); }).mapToDouble(function(item){ return 1.2 * Math.sqrt(item.level); }).sum();
}

/**
 * ソフトキャップ
 * 
 * @param {Number} 火力
 * @param {Number} キャップ値
 * @return {Number} 補正後火力
 */
function softcap(power,cap){
    return (power > cap ? cap + Math.sqrt(power - cap) : power);
}

/**
 * 砲撃戦種別を返します。
 * 
 * @param {logbook.dto.ShipDto} ship 艦娘のデータ
 * @return {Number} 種別
 */
function getHougekiKind(origin){
    // それ以外の処理
    // 速吸改or陸上型
    if(origin.shipId == 352 || origin.param.soku == 0){
        // 攻撃機が存在するか
        var item2 = new LinkedList(origin.item2);
        if(origin instanceof ShipDto) item2.add(origin.slotExItem);
        var hasTorpedoBomber = item2.stream().filter(function(item){ return item != null; }).mapToInt(function(item){ return item.type2; }).anyMatch(function(type2){ return type2 == 7 || type2 == 8 || type2 == 47; });
        return hasTorpedoBomber ? 7 : 0; // 空撃or砲撃
    } else {
        switch(origin.stype){
            case 7:  // 軽空母
            case 11: // 正規空母
            case 18: // 装甲空母
                return 7; // 空撃
            default:
                return 0; // それ以外
        }
    }
}

/**
 * 弾着ダメージ倍率を返します。
 * 
 * @param {Number} kind 種別
 * @return {Number} 補正倍率
 */
function getDanchakuDamageMagnification(kind){
    switch(kind){
        case 2: return 1.2; // 連続
        case 3: return 1.1; // 主砲+副砲
        case 4: return 1.2; // 主砲+電探
        case 5: return 1.3; // 主砲+徹甲弾
        case 6: return 1.5; // 主砲+主砲
        default:return 1.0; // 1回攻撃
    }
}

/**
 * 夜戦CIダメージ倍率を返します。
 * 
 * @param {*} origin
 * @param {Number} kind 種別
 * @return {Number} 補正倍率
 */
function getYasenCutinBonus(origin,kind){
    switch(Number(kind)){
        case 1: return 1.2;   // 連撃
        case 2: return 1.3;   // 主魚CI
        case 3:
            var item2 = new LinkedList(origin.item2);
            if(origin instanceof ShipDto) item2.add(origin.slotExItem);
            var lateTorpedo = item2.stream().filter(function(item){ return item != null }).mapToInt(function(item){ return item.getSlotitemId(); }).filter(function(id){ return id == 213 || id == 214; }).count();
            var radiolocator = item2.stream().filter(function(item){ return item != null }).mapToInt(function(item){ return item.type1; }).filter(function(type1){ return type1 == 42; }).count();
            if(lateTorpedo >= 1 && radiolocator >= 1) return 1.75; // 後電CI
            if(lateTorpedo >= 2) return 1.6; // 後魚CI
            return 1.5;   // 魚雷CI
        case 4: return 1.75;  // 主主副CI
        case 5: return 2.0;   // 主砲CI
        default:return 1.0;   // 1回攻撃
    }
}

/**
 * 弾薬補正(キャップ後最終計算)
 * 
 * @param {logbook.dto.ShipDto} ship 艦娘のデータ
 * @param {Boolean} isFriend
 * @return {Number} 補正火力
 */
function getAmmoBonus(ship,isFriend){
    return isFriend ? Math.min(Math.floor(ship.bull / ship.bullMax * 100) / 50,1) : 1.0;
}

/**
 * 耐久補正
 * 
 * @param {Number} max 
 * @param {Number} now 
 * @param {Boolean} isRaigeki
 * @return {Number} 
 */
function getHPPowerBonus(max,now,isRaigeki){
    var rate = now / max;
    // print("max:" + max + " now:" + now + " rate:" + rate)
    if(rate <= 0.25){
        return isRaigeki ? 0 : 0.4;
    } else if(rate <= 0.5){
        return isRaigeki ? 0.8 : 0.7;
    }
    return 1.0;
}

function toHPStateString(max,now){
    var rate = now / max;
    // print("max:" + max + " now:" + now + " rate:" + rate)
    if(rate <= 0.25){
        return "大破";
    } else if(rate <= 0.5){
        return "中破";
    } else if(rate <= 0.75){
        return "小破";
    }
    return "小破未満";
}

/**
 * 軽巡軽量砲補正を返します。
 * 
 * @param {logbook.dto.ShipDto} ship 艦娘のデータ
 * @return {Number} 補正火力
 */
function getCLLightGunPowerBonus(origin){
    switch(origin.stype){
        case 3:  // 軽巡
        case 4:  // 雷巡
        case 21: // 練巡
            var item2 = new LinkedList(origin.item2);
            if(origin instanceof ShipDto) item2.add(origin.slotExItem);
            var single = item2.stream().filter(function(item){
                return item != null;
            }).filter(function(item){
                switch(item.slotitemId){
                    case 4:  // 14cm単装砲
                    case 11: // 15.2cm単装砲
                        return true;
                    default:
                        return false;
                }
            }).count();
            var twin = item2.stream().filter(function(item){
                return item != null;
            }).filter(function(item){
                switch(item.slotitemId){
                    case 65:  // 15.2cm連装砲
                    case 119: // 14cm連装砲
                    case 139: // 15.2cm連装砲改
                        return true;
                    default:
                        return false;
                }
            }).count();
            return Math.sqrt(twin) * 2 + Math.sqrt(single);
        default:
            return 0;
    } 
}

/**
 * 陸上特効倍率を返します。
 * 
 * @param {logbook.dto.ShipDto} origin
 * @param {logbook.dto.EnemyShipDto} target
 * @return {Number} description
 */
function getLandBonus(_origin,_target){
    if(_target.param.soku > 0) return 1.0;
    var type3shellBonus = function(origin,target){
        var item2 = new LinkedList(origin.item2);
        if(origin instanceof ShipDto) item2.add(origin.slotExItem);
        var type3shell = item2.stream().filter(function(item){ return item != null && item.getSlotitemId() == 35; }).count();
        if(type3shell == 0) return 1.0;
        switch(target.getShipId()){
            case 668:
            case 669:
            case 670:
            case 671: // 離島棲姫
            case 672: return 1.75;
            case 665:
            case 666: // 砲台小鬼
            case 667: return 1.0;
            default:  return 2.5;
        }
    }(_origin,_target);
    var originalBonus = function(origin,target){
        var item2 = new LinkedList(origin.item2);
        if(origin instanceof ShipDto) item2.add(origin.slotExItem);
        var daihatsu = item2.stream().filter(function(item){ return item != null && item.getSlotitemId() == 68; }).count();
        var daihatsuAlv = item2.stream().filter(function(item){ return item != null && item.getSlotitemId() == 68; }).mapToInt(function(item){ return item.getLevel(); }).average().orElse(0);
        var rikuDaihatsu = item2.stream().filter(function(item){ return item != null && item.getSlotitemId() == 166; }).count();
        var rikuDaihatsuAlv = item2.stream().filter(function(item){ return item != null && (item.getSlotitemId() == 68 || item.getSlotitemId() == 166); }).mapToInt(function(item){ return item.getLevel(); }).average().orElse(0);
        var kamisha = item2.stream().filter(function(item){ return item != null && item.getSlotitemId() == 167; }).count();
        var kamishaAlv = item2.stream().filter(function(item){ return item != null && item.getSlotitemId() == 167; }).mapToInt(function(item){ return item.getLevel(); }).average().orElse(0);
        var suijo = item2.stream().filter(function(item){ return item != null && (item.type2 == 11 || item.type2 == 45); }).count();
        var apShell = item2.stream().filter(function(item){ return item != null && item.type1 == 25; }).count();
        var wg42 = item2.stream().filter(function(item){ return item != null && item.getSlotitemId() == 126; }).count();

        switch(target.getShipId()){
            case 668:
            case 669:
            case 670:
            case 671: 
            case 672: // 離島棲姫
                var wg42Bonus = (wg42 >= 2) ? 2.1 : (wg42 == 1 ? 1.4 : 1.0);
                return wg42Bonus;
            case 665:
            case 666: 
            case 667: // 砲台小鬼
                var stype = origin.getStype();
                // 駆逐・軽巡のみ
                var stypeBonus = (stype == 2 || stype == 3) ? 1.4 : 1.0;
                var daihatsuBonus = (daihatsu >= 1 ? 1.8 : 1.0) * (1 + daihatsuAlv / 50);
                var rikuDaihatsuBonus = function(num){
                    if(num >= 2) return 3.0;
                    if(num == 1) return 2.15;
                    return 1.0;
                }(rikuDaihatsu) * (1 + rikuDaihatsuAlv / 50);
                var kamishaBonus = function(num){
                    if(num >= 2) return 3.2;
                    if(num == 1) return 2.4;
                    return 1.0;
                }(kamisha) * (1 + kamishaAlv / 30);
                var suijoBonus = (suijo >= 1) ? 1.5 : 1.0;
                var apShellBonus = (apShell >= 1) ? 1.85 : 1.00;
                var wg42Bonus = (wg42 >= 2) ? 2.72 : (wg42 == 1 ? 1.60 : 1.00);
                return stypeBonus * (rikuDaihatsu > 0 ? rikuDaihatsuBonus : daihatsuBonus) * kamishaBonus * suijoBonus * apShellBonus * wg42Bonus;
            default:
                return 1.0;
        }
    }(_origin,_target);
    return type3shellBonus * originalBonus;
}

/**
 * WG42加算特効を返します。
 * 
 * @param {logbook.dto.ShipDto} ship 
 * @param {logbook.dto.EnemyShipDto} target 
 * @return {Number} description
 */
function getWGBonus(origin,target){
    var item2 = new LinkedList(origin.item2);
    if(origin instanceof ShipDto) item2.add(origin.slotExItem);
    var wgCount = item2.stream().filter(function(item){
        return item != null;
    }).filter(function(item){
        return item.getSlotitemId() == 126;
    }).count();
    if(target.param.soku > 0) return 0;
    switch(wgCount){
        case 1: return 75;
        case 2: return 110;
        case 3: return 140;
        case 4: return 160;
        default:return 0;
    }
}

/**
 * 交戦形態補正倍率を返します。
 * 
 * @param {Number} formationMatch 交戦形態
 * @return {Number} description
 */
function getFormationMatchBonus(formationMatch){
    switch(formationMatch){
        case 1: return 1.0; // 同航戦
        case 2: return 0.8; // 反航戦
        case 3: return 1.2; // T字有利
        case 4: return 0.6; // T字不利
        default:return 1.0;
    }
}

/**
 * 攻撃側陣形補正を返します。
 * 
 * @param {Number} formationMatch 陣形補正
 * @param {boolean} isRaigeki 雷撃か
 * @return {Number} description
 */
function getFormationBonus(formation,isRaigeki){
    var _isRaigeki = typeof isRaigeki != 'undefined' ? isRaigeki : false; 
    if(_isRaigeki){
        switch(formation){
            case 1: return 1.0; // 単縦陣
            case 2: return 0.8; // 複縦陣
            case 3: return 0.7; // 輪形陣
            case 4: return 0.6; // 梯形陣
            case 5: return 0.6; // 単横陣
            case 11:return 0.7; // 第一警戒航行序列
            case 12:return 0.9; // 第二警戒航行序列
            case 13:return 0.6; // 第三警戒航行序列
            case 14:return 1.0; // 第四警戒航行序列
            default:return 1.0;
        }
    } else {
        switch(formation){
            case 1: return 1.0; // 単縦陣
            case 2: return 0.8; // 複縦陣
            case 3: return 0.7; // 輪形陣
            case 4: return 0.6; // 梯形陣
            case 5: return 0.6; // 単横陣
            case 11:return 0.8; // 第一警戒航行序列
            case 12:return 1.0; // 第二警戒航行序列
            case 13:return 0.7; // 第三警戒航行序列
            case 14:return 1.1; // 第四警戒航行序列
            default:return 1.0;
        }
    }
}

/**
 * 連合艦隊砲撃補正を返します。
 * 
 * @param {Number} friendCombinedKind 味方連合艦隊の種類
 * @param {Number} enemyCombinedKind 敵連合艦隊の種類 
 * @param {Boolean} isFriend 味方が攻撃側か 
 * @return {Number}
 */
function getCombinedHougekiPoewrBonus(friendCombinedKind,enemyCombinedKind,isFriend){
    if(isFriend){
        if(enemyCombinedKind > 0){
            switch(friendCombinedKind){
                case 0:  // 味方:通常艦隊               -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return  5;
                case 11: // 味方:空母機動部隊(第一艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return  2;
                case 12: // 味方:空母機動部隊(第二艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return -5;
                case 21: // 味方:水上打撃部隊(第一艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return  2;
                case 22: // 味方:水上打撃部隊(第二艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return -5;
                case 31: // 味方:輸送護衛部隊(第一艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return -5;
                case 32: // 味方:輸送護衛部隊(第二艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return -5;
                default:
                    return 0;
            }
        } else {
            switch(friendCombinedKind){
                case 0:  // 味方:通常艦隊               -> 敵:通常艦隊
                    return  0;
                case 11: // 味方:空母機動部隊(第一艦隊) -> 敵:通常艦隊
                    return  2;
                case 12: // 味方:空母機動部隊(第二艦隊) -> 敵:通常艦隊
                    return 10;
                case 21: // 味方:水上打撃部隊(第一艦隊) -> 敵:通常艦隊
                    return 10;
                case 22: // 味方:水上打撃部隊(第二艦隊) -> 敵:通常艦隊
                    return -5;
                case 31: // 味方:輸送護衛部隊(第一艦隊) -> 敵:通常艦隊
                    return -5;
                case 32: // 味方:輸送護衛部隊(第二艦隊) -> 敵:通常艦隊
                    return 10;
                default:
                    return 0;
            }
        }
    } else {
        if(enemyCombinedKind > 0){
            if(enemyCombinedKind % 10 == 1){
                // 敵:空母機動部隊(第一艦隊) -> 味方:Any
                return 10;
            } else {
                // 敵:空母機動部隊(第二艦隊) -> 味方:Any
                return -5;
            }
        } else {
            switch(friendCombinedKind){
                case 0:  // 敵:通常艦隊 -> 味方:通常艦隊
                    return  0;
                case 11: // 敵:通常艦隊 -> 味方:空母機動部隊(第一艦隊)
                    return 10;
                case 12: // 敵:通常艦隊 -> 味方:空母機動部隊(第二艦隊)
                    return  5;
                case 21: // 敵:通常艦隊 -> 味方:水上打撃部隊(第一艦隊)
                    return  5;
                case 22: // 敵:通常艦隊 -> 味方:水上打撃部隊(第二艦隊)
                    return -5;
                case 31: // 敵:通常艦隊 -> 味方:輸送護衛部隊(第一艦隊)
                    return 10;
                case 32: // 敵:通常艦隊 -> 味方:輸送護衛部隊(第二艦隊)
                    return  5;
                default:
                    return 0;
            }
        }
    }
}

/**
 * 連合艦隊雷撃補正を返します。
 * 
 * @param {Number} friendCombinedKind 味方連合艦隊の種類
 * @param {Number} enemyCombinedKind 敵連合艦隊の種類 
 * @param {Boolean} isFriend 味方が攻撃側か 
 * @return {Number}
 */
function getCombinedRaigekiPoewrBonus(friendCombinedKind,enemyCombinedKind,isFriend){
    if(isFriend){
        if(enemyCombinedKind > 0){
            if(friendCombinedKind > 0){
                // 味方:連合艦隊(第二艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                return 10;
            } else {
                // 味方:通常艦隊           -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                return 10;
            }
        } else {
            if(friendCombinedKind > 0){
                // 味方:連合艦隊(第二艦隊) -> 敵:通常艦隊
                return -5;
            } else {
                // 味方:通常艦隊           -> 敵:通常艦隊
                return 0;
            }
        }
    } else {
        if(enemyCombinedKind > 0){
            // 敵:連合艦隊(第二艦隊) -> 味方:Any
            return 5;
        } else {
            if(friendCombinedKind > 0){
                // 敵:通常艦隊 -> 味方:連合艦隊(第一艦隊/第二艦隊)
                return -5;
            } else {
                // 敵:通常艦隊 -> 味方:通常艦隊
                return 0;
            }
        }
    }
}

/**
 * 
 * @param {String} s 
 * @return {Number} 
 */
function fromFormationMatch(s){
    switch(s){
        case "同航戦": return 1;
        case "反航戦": return 2;
        case "Ｔ字有利": return 3;
        case "Ｔ字不利": return 4;
        default: return 1;
    }
}

function toFormationMatchString(k){
    switch(k){
        case 1: return "同航戦(x1.0)";
        case 2: return "反航戦(x0.8)";
        case 3: return "Ｔ字有利(x1.2)";
        case 4: return "Ｔ字不利(x0.6)";
        default: return "不明(" + k + ")";
    }
}

function toFormationString(formation,isRaigeki){
    var _isRaigeki = typeof isRaigeki != 'undefined' ? isRaigeki : false; 
    if(_isRaigeki){
        switch(formation){
            case 1: return "単縦陣(x1.0)";
            case 2: return "複縦陣(x0.8)";
            case 3: return "輪形陣(x0.7)";
            case 4: return "梯形陣(x0.6)";
            case 5: return "単横陣(x0.6)";
            case 11:return "第一警戒航行序列(x0.7)";
            case 12:return "第二警戒航行序列(x0.9)";
            case 13:return "第三警戒航行序列(x0.6)";
            case 14:return "第四警戒航行序列(x1.0)";
            default:return "不明";
        }
    } else {
        switch(formation){
            case 1: return "単縦陣(x1.0)";
            case 2: return "複縦陣(x0.8)";
            case 3: return "輪形陣(x0.7)";
            case 4: return "梯形陣(x0.6)";
            case 5: return "単横陣(x0.6)";
            case 11:return "第一警戒航行序列(x0.8)";
            case 12:return "第二警戒航行序列(x1.0)";
            case 13:return "第三警戒航行序列(x0.7)";
            case 14:return "第四警戒航行序列(x1.1)";
            default:return "不明";
        }
    }
}

/**
 * 
 * @param {String[]} a 
 * @return {Number[]}
 */
function fromFormations(a){
    return [BattleExDto.fromFormation(a[0]),BattleExDto.fromFormation(a[1])];
}

/**
 * 集積地特効
 * 
 * @param {logbook.dto.ShipDto} origin 
 * @param {logbook.dto.ShipDto} target 
 * @return {Number}
 */
function getShusekiBonus(origin,target){
    switch(target.getShipId()){
        case 653:
        case 654:
        case 655:
        case 656:
        case 657:
        case 658:
            var item2 = new LinkedList(origin.item2);
            if(origin instanceof ShipDto) item2.add(origin.slotExItem);
            var wg42 = item2.stream().filter(function(item){ return item != null && item.slotitemId == 126; }).count();
            var rikuDaihatsu = item2.stream().filter(function(item){ return item != null && item.slotitemId == 166; }).count();
            var kamisha = item2.stream().filter(function(item){ return item != null && item.slotitemId == 167; }).count();
            var wg42bonus = function(num){
                if(num == 1) return 1.25;
                if(num >= 2) return 1.625;
                return 1.0;
            }(wg42);
            var rikuDaihatsuBonus = function(num){
                if(num == 1) return 1.30;
                if(num >= 2) return 2.08;
                return 1.0;
            }(rikuDaihatsu);
            var kamishaBonus = function(num){
                if(num == 1) return 1.70;
                if(num >= 2) return 2.50;
                return 1.0;
            }(kamisha);
            return wg42bonus * rikuDaihatsuBonus * kamishaBonus;
        default:
            return 1.0;
    }
}

/**
 * 徹甲弾補正
 * 
 * @param {logbook.dto.ShipDto} origin 
 * @param {logbook.dto.ShipDto} target 
 * @return {Number}
 */
function getAPshellBonus(origin,target){
    switch(target.getStype()){
        case 5:  // 重巡洋艦
        case 6:  // 航空巡洋艦
        case 8:  // 巡洋戦艦
        case 9:  // 戦艦
        case 10: // 航空戦艦
        case 11: // 正規空母
        case 12: // 超弩級戦艦
        case 18: // 装甲空母
            var item2 = new LinkedList(origin.item2);
            if(origin instanceof ShipDto) item2.add(origin.slotExItem);
            var mainGun = item2.stream().filter(function(item){ return item != null; }).anyMatch(function(item){ return item.type1 == 1; });
            var subGun = item2.stream().filter(function(item){ return item != null; }).anyMatch(function(item){ return item.type1 == 2; });
            var apShell = item2.stream().filter(function(item){ return item != null; }).anyMatch(function(item){ return item.type1 == 25; });
            var radar = item2.stream().filter(function(item){ return item != null; }).anyMatch(function(item){ return item.type1 == 8; });
            if(mainGun && apShell){
                if(subGun) return 1.15;
                if(radar)  return 1.10;
                return 1.08;
            }
            return 1.0;
        default:
            return 1.0;
    }
}

/**
 * クリティカル補正
 * 
 * @param {Number} critical 
 * @return {Number}
 */
function getCriticalBonus(critical){
    return (critical == 2) ? 1.5 : 1.0;
}

/**
 * クリティカルか
 * 
 * @param {Number} critical 
 * @return {Boolean}
 */
function isCritical(critical){
    return critical == 2;
}

/**
 * 熟練度補正
 * 
 * @param {logbook.dto.ShipDto} ship 
 * @return {Number}
 */
function getSkilledBonus(origin,isMin,isAir){
    var SKILLED_BONUS = [
        [0.00,0.03],
        [0.04,0.05],
        [0.07,0.08],
        [0.09,0.10],
        [0.11,0.12],
        [0.13,0.16],
        [0.16,0.16],
        [0.20,0.20],
    ]
    var isSkilledObject = function(type2){
        switch(type2){
            case 7:  // 艦上爆撃機
            case 8:  // 艦上攻撃機
            case 11: // 水上爆撃機
            case 57: // 噴式戦闘爆撃機
            case 58: // 噴式攻撃機
                return true;
            default:
                return false;
        }
    };
    var result = 1.0;
    var item2 = new LinkedList(origin.item2);
    if(origin instanceof ShipDto) item2.add(origin.slotExItem);
    var isAirBattle = typeof isAir != 'undefined' ? isAir : false;
    if(getHougekiKind(origin) == 7 || isAirBattle){
        for(var i = 0;i < item2.size();i++){
            var item = item2.get(i);
            if(item != null && isSkilledObject(item.type2)){
                //print(i,item.name,item.getAlv())
                var alv = item.getAlv();
                if(alv > 0){
                    if(i == 0){
                        result += SKILLED_BONUS[alv][(isMin ? 0 : 1)];
                    } else {
                        result += SKILLED_BONUS[alv][(isMin ? 0 : 1)] / 2;
                    }
                }
            }
        }
    }
    return result;
}

/**
 * 弾着補正
 * 
 * @param {Number} kind 
 */
function getStrikingBonus(kind){
    switch(kind){
        case 0: return 1.0; // 通常攻撃
        case 1: return 1.0; // レーザー攻撃
        case 2: return 1.2; // 連撃
        case 3: return 1.1; // 主砲+副砲
        case 4: return 1.2; // 主砲+電探
        case 5: return 1.3; // 主砲+徹甲弾
        case 6: return 1.5; // 主砲+主砲
        default:return 1.0; // それ以外
    }
}

function toStrikingKindString(kind){
    switch(kind){
        case 0: return "通常攻撃(x1.0)";
        case 1: return "超重力砲(x?.?)";
        case 2: return "連撃(x1.2)";
        case 3: return "主砲+副砲(x1.1)";
        case 4: return "主砲+電探(x1.2)";
        case 5: return "主砲+徹甲弾(x1.3)";
        case 6: return "主砲+主砲(x1.5)";
        default:return "？？？";
    }
}

/**
 * PT特効
 * 
 * @param {logbook.dto.ShipDto} origin 
 * @param {logbook.dto.ShipDto} target 
 */
function getPtBonus(origin,target){
    switch(target.getShipId()){
        case 637:
        case 638:
        case 639:
        case 640:
            var item2 = new LinkedList(origin.item2);
            if(origin instanceof ShipDto) item2.add(origin.slotExItem);
            // 小口径主砲
            var sMainGun = item2.stream().filter(function(item){ return item != null && item.type2 == 1; }).count();
            // 機銃
            var aaGun = item2.stream().filter(function(item){ return item != null && item.type2 == 21; }).count();
            // 副砲
            var subGun = item2.stream().filter(function(item){ return item != null && item.type2 == 4; }).count();
            // 三式弾
            var type3Shell = item2.stream().filter(function(item){ return item != null && item.type2 == 18; }).count();
            var aaGunBonus = (aaGun >= 2) ? 1.1 : 1.0;
            var sMainGunBonus = function(ship,num){
                switch(ship.getShipId()){
                    case 445: // 秋津洲
                    case 450: // 秋津洲改
                    case 352: // 速吸改
                    case 460: // 速吸
                        return 1.0;
                    default:
                        return (num >= 2) ? 1.2 : 1.0;
                }
            }(origin,sMainGun);
            var subGunBonus = function(ship,num){
                switch(ship.getStype()){
                    case 3: // 軽巡洋艦
                    case 4: // 重雷装巡洋艦
                        return 1.0;
                    default:
                        return (num >= 2) ? 1.2 : 1.0;
                }
            }(origin,subGun);
            var type3ShellBonus = (type3Shell >= 1) ? 1.3 : 1.0;
            return aaGunBonus * sMainGunBonus * subGunBonus * type3ShellBonus;
        default:
            return 1.0;
    }
}

function genAirBattle(air,friendHp,enemyHp){
    // print("friendHp(air):" + friendHp)
    // print("enemyHp(air):" + enemyHp)
    if((air == null) || (air.atacks == null) || (air.atacks.size() == 0)) return;
    for(var i in air.atacks){
        var atack = air.atacks[i];
        var targetHp;
        if(atack.friendAtack){
            targetHp = enemyHp;
        } else {
            targetHp = friendHp;
        }
        for(var j in atack.damage){
            // print("targetHp[atack.target[" + j + "]]:" + targetHp[atack.target[j]] + " atack.damage[" + j + "]:" + atack.damage[j])
            targetHp[atack.target[j]] -= atack.damage[j];
        }
    }
}

function genSupportAttack(atacks,friendHp,enemyHp){
    // ダメージ処理
    atacks.forEach(function(atack){
        var targetHp;
        if(atack.friendAtack){
            targetHp = enemyHp;
        } else {
            targetHp = friendHp;
        }
        for(var i in atack.damage){
            var targetIdx = atack.target[i];
            targetHp[targetIdx] -= atack.damage[i];
        }
    });
}

function getRaigekiOrder(kind){
    switch (kind) {
    /** 連合艦隊空母機動部隊の昼戦 */
    case BattlePhaseKind.COMBINED_BATTLE:
    /** 通常艦隊敵連合艦隊の昼戦*/
    case BattlePhaseKind.COMBINED_EC_BATTLE:
        return 1;
    /** 連合艦隊(機動部隊) vs 敵連合艦隊の昼戦 */
    case BattlePhaseKind.COMBINED_EACH_BATTLE:
        return 2;
    default:
        return -1;
    }
}

function toCombinedKind(type,idx){
    if(type == 0) return 0;
    return type * 10 + (idx < 6 ? 1 : 2);
}

function toFriendCombinedKindString(k){
    switch(k){
        case 0:  return "通常艦隊";
        case 11: return "空母機動部隊(第一艦隊)";
        case 12: return "空母機動部隊(第二艦隊)";
        case 21: return "水上打撃部隊(第一艦隊)";
        case 22: return "水上打撃部隊(第二艦隊)";
        case 31: return "輸送護衛部隊(第一艦隊)";
        case 32: return "輸送護衛部隊(第二艦隊)";
        default: return "？？？";
    }
}

function toEnemyCombinedKindString(k){
    switch(k){
        case 0:  return "通常艦隊";
        case 11: return "連合艦隊(第一艦隊)";
        case 12: return "連合艦隊(第二艦隊)";
        default: return "？？？";
    }
}

function isAbnormalDamage(damage,minDmg,maxDmg,minPropDmg,maxPropDmg,targetHp,minSunkDmg,maxSunkDmg,isFriend,isHp1Obj){
    // ダメージ判定
    if(minDmg - (MODE.STRICT ? 0 : 1) <= damage && damage <= maxDmg + (MODE.STRICT ? 0 : 1)){
        return false;
    }
    // カスダメ判定
    if(minPropDmg <= damage && damage <= maxPropDmg){
        return false;
    }
    // 轟沈ストッパー
    if(!isFriend && (targetHp - damage) > 0 && minSunkDmg <= damage && damage <= maxSunkDmg){
        return false;
    }
    // HP1置き換え
    if(isHp1Obj){
        return false;
    }
    return damage != 0;
}

function isMaelstromMap(battle){
    var area = battle.getMapCellDto().getMap()[0];
    var info = battle.getMapCellDto().getMap()[1];
    return MAELSTROM_MAP_LIST.some(function(x,i,a){
        return area == x[0] && info == x[1];
    });
}

function isException(battle){
    var area = battle.getMapCellDto().getMap()[0];
    var info = battle.getMapCellDto().getMap()[1];
    // PT初登場マップ除去
    var EXCEPTION_MAP_LIST = [
        [32,2],
        [32,3],
        [32,4],
        [32,5],
    ]
    return EXCEPTION_MAP_LIST.some(function(x,i,a){
        return area == x[0] && info == x[1];
    }); // 強制除去
}

function isHp1ReplacementObj(origin,idx){
    if(origin instanceof ShipDto){
        return (idx % 6 != 0 && origin.cond < 20);
    }
    return false;
}

/**
 * ファイルに書き込む
 */
function write(s,p){
    try{
        var pw;
        var path = p === undefined ? Paths.get(FILE_NAME) : p;
        if(Files.notExists(path)){
            pw = new PrintWriter(Files.newBufferedWriter(path,Charset.defaultCharset()));
        } else {
            pw = new PrintWriter(Files.newBufferedWriter(path,Charset.defaultCharset(),StandardOpenOption.WRITE,StandardOpenOption.APPEND));
        }
        pw.println(s);
        pw.close();
    } catch(e) {
        e.printStackTrace();
    }
}

function toSpAttackKindString(origin,kind){
    switch(Number(kind)){
        case 1: return "連撃(x1.2)";   // 連撃
        case 2: return "主魚CI(x1.3)";   // 主魚CI
        case 3:
            var item2 = new LinkedList(origin.item2);
            if(origin instanceof ShipDto) item2.add(origin.slotExItem);
            var lateTorpedo = item2.stream().filter(function(item){ return item != null }).mapToInt(function(item){ return item.getSlotitemId(); }).filter(function(id){ return id == 213 || id == 214; }).count();
            var radiolocator = item2.stream().filter(function(item){ return item != null }).mapToInt(function(item){ return item.type1; }).filter(function(type1){ return type1 == 42; }).count();
            if(lateTorpedo >= 1 && radiolocator >= 1) return "後電CI(x1.75)"; // 後電CI
            if(lateTorpedo >= 2) return "後魚CI(x1.6)"; // 後魚CI
            return "魚雷CI(x1.5)";   // 魚雷CI
        case 4: return "主副CI(x1.75)";  // 主主副CI
        case 5: return "主砲CI(x2.0)";   // 主砲CI
        default:return "通常攻撃(x1.0)";   // 1回攻撃
    }
}

function iniFile(p){
    try{
        var path = p === undefined ? Paths.get(FILE_NAME) : p;
        if(Files.exists(path)){
            var pw = new PrintWriter(Files.newBufferedWriter(path,Charset.defaultCharset(),StandardOpenOption.TRUNCATE_EXISTING));
            pw.close();
        }
    } catch(e) {
        e.printStackTrace();
    }
}

function toItemString(item2){
    var getLevelText = function(lv){
        switch(lv){
            case 0: return "";
            case 1: return " ★+1";
            case 2: return " ★+2";
            case 3: return " ★+3";
            case 4: return " ★+4";
            case 5: return " ★+5";
            case 6: return " ★+6";
            case 7: return " ★+7";
            case 8: return " ★+8";
            case 9: return " ★+9";
            case 10:return " ★max";
        }
    }
    var getAlvText = function(alv){
        switch(alv){
            case 0: return "";
            case 1: return " |";
            case 2: return " ||";
            case 3: return " |||";
            case 4: return " \\";
            case 5: return " \\\\";
            case 6: return " \\\\\\";
            case 7: return " >>";
        }
    }
    return item2.stream().map(function(item){
        return (item != null ? (("000" + item.slotitemId).slice(-3) + ":" + item.name + getAlvText(item.alv) + getLevelText(item.level)) : "---:装備なし");
    }).collect(Collectors.joining(crlf));
}