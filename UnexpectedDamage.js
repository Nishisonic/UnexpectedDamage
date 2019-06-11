//#region Library
Calendar = Java.type("java.util.Calendar")
TimeZone = Java.type("java.util.TimeZone")
DataType = Java.type("logbook.data.DataType")
AppConstants = Java.type("logbook.constants.AppConstants")
BattlePhaseKind = Java.type("logbook.dto.BattlePhaseKind")
EnemyShipDto = Java.type("logbook.dto.EnemyShipDto")
ShipDto = Java.type("logbook.dto.ShipDto")
Item = Java.type("logbook.internal.Item")
Ship = Java.type("logbook.internal.Ship")
//#endregion

//#region 全般

/** バージョン */
var VERSION = 1.50
/** バージョン確認URL */
var UPDATE_CHECK_URL = "https://raw.githubusercontent.com/Nishisonic/UnexpectedDamage/master/update2.txt"
/** ファイルの場所 */
var FILE_URL = [
    "https://raw.githubusercontent.com/Nishisonic/UnexpectedDamage/master/drop_unexpectedDamage.js",
    "https://raw.githubusercontent.com/Nishisonic/UnexpectedDamage/master/UnexpectedDamage.js",
    "https://raw.githubusercontent.com/Nishisonic/UnexpectedDamage/master/dropstyle.js",
]
/** 保存場所 */
var EXECUTABLE_FILE = [
    "script/drop_unexpectedDamage.js",
    "script/UnexpectedDamage.js",
    "script/dropstyle.js",
]
/** ログファイル保存の場所 */
var LOG_FILE = "damage.log"

/** ScriptData用 */
var data_prefix = "damage_"

var isAkakari = AppConstants.NAME.indexOf("赤仮") >= 0

//#endregion

//#region 艦これ計算部分

/**
 * 昼戦火力算出
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} attackNum 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか
 * @param {FleetDto} origins 攻撃側艦隊
 * @return {AntiSubmarinePower|DayBattlePower} 昼戦火力
 */
var getDayBattlePower = function (date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    if (isSubMarine(defender)) {
        // 対潜水艦
        return new AntiSubmarinePower(date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    } else {
        // 対水上艦
        return new DayBattlePower(date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    }
}

/**
 * 雷撃戦火力算出
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} attackNum 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @return {TorpedoPower} 雷撃火力
 */
var getTorpedoPower = function (date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, attack, attacker, defender, attackerHp) {
    return new TorpedoPower(date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, attack, attacker, defender, attackerHp)
}

/**
 * 夜戦火力算出
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} attackNum 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 夜戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {[Number,Number]} touchPlane 夜間触接
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか
 * @param {FleetDto} origins 攻撃側艦隊
 * @return {AntiSubmarinePower|NightBattlePower} 夜戦火力
 */
var getNightBattlePower = function (date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, touchPlane, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    if (isSubMarine(defender)) {
        // 対潜水艦
        return new AntiSubmarinePower(date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    } else {
        // 対水上艦
        return new NightBattlePower(date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, touchPlane, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    }
}

/**
 * レーダー射撃戦火力算出
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} attackNum 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation レーダー射撃戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか
 * @param {FleetDto} origins 攻撃側艦隊
 * @return {AntiSubmarinePower|NightBattlePower} 夜戦火力
 */
var getRadarShootingPower = function (date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    if (isSubMarine(defender)) {
        // 対潜水艦
        return new AntiSubmarinePower(date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins, true)
    } else {
        // 対水上艦
        return new NightBattlePower(date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, [-1, -1], attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    }
}

/**
 * 昼戦の攻撃種別
 * BattleMain.setOptionsAtHougeki(slotitemMasterIDs:Array, type:int) に準ずる
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @return {0|1|2|3} 攻撃手段(0=砲撃,1=空撃,2=爆雷,3=雷撃)
 */
var getAttackTypeAtDay = function (attack, attacker, defender) {
    // ロケットフラグ判定
    // 大発エフェクトid取得

    if (attacker.shipId === 352) {
        if (isSubMarine(defender)) {
            if (getItems(attacker).some(function (item) { return item.type2 === 8 && item.param.taisen > 0 || item.type2 === 7 || item.type2 === 25 })) {
                return 1
            } else {
                return 2
            }
        } else if (getItems(attacker).some(function (item) { return item.type2 === 8 })) {
            return 1
        } else {
            return 0
        }
    }

    if (attacker.stype === 7 || attacker.stype === 11 || attacker.stype === 18) {
        return 1
    }

    if (isSubMarine(defender)) {
        if (attacker.stype === 6 || attacker.stype === 10 || attacker.stype === 16 || attacker.stype === 17) {
            return 1
        } else {
            return 2
        }
    }

    if (Number(attack.showItem[0]) !== -1 && (Item.get(attack.showItem[0]).type2 === 5 || Item.get(attack.showItem[0]).type2 === 32)) {
        return 3
    }

    return 0
}

/**
 * 夜戦の攻撃種別
 * BattleMain.setOptionsAtNight(slotitemMasterIDs:Array, specialFlag:int, yasen_kubo:Boolean) に準ずる
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @return {0|1|2|3} 攻撃手段(0=砲撃,1=空撃,2=爆雷,3=雷撃)
 */
var getAttackTypeAtNight = function (attack, attacker, defender) {
    // ロケットフラグ判定
    // 大発エフェクトid取得
    // 夜戦空母攻撃判定

    if (attacker.stype === 7) {
        if (isSubMarine(defender)) {
            return 2
        }
    }

    if (attacker.stype === 7 || attacker.stype === 11 || attacker.stype === 18) {
        if (attacker.shipId === 353 || attacker.shipId === 432 || attacker.shipId === 433) {
            return 0
        } else if (attacker.name === "リコリス棲姫") {
            return 0
        } else if (attacker.name === "深海海月姫") {
            return 0
        } else {
            return 1
        }
    }

    if (isSubMarine(attacker)) {
        return 3
    }

    if (isSubMarine(defender)) {
        if (attacker.stype === 6 || attacker.stype === 10 || attacker.stype === 16 || attacker.stype === 17) {
            return 1
        } else {
            return 2
        }
    }

    if (Number(attack.showItem[0]) !== -1 && (Item.get(attack.showItem[0]).type2 === 5 || Item.get(attack.showItem[0]).type2 === 32)) {
        return 3
    }

    return 0
}

/**
 * 潜水艦かどうか
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 * @return {boolean} 潜水艦か
 */
var isSubMarine = function (ship) {
    return ship.stype === 13 || ship.stype === 14
}

/**
 * 陸上型かどうか(艦これの書き方)
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 * @return {boolean} 陸上型か
 */
var isGround = function (ship) {
    return ship.param.soku <= 0
}

/**
 * 艦の装備を取得する(補強増設装備も取得)
 * その際、積んでいないスロは削除される
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 * @return {[logbook.dto.ItemDto]} 装備
 */
var getItems = function (ship) {
    var items = Java.from(ship.item2.toArray())
    if (ship instanceof ShipDto) items.push(ship.slotExItem)
    return items.filter(function (item) { return item !== null })
}

//#region 対潜関連

/**
 * 対潜関連処理
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} attackNum 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {FleetDto} origins 攻撃側艦隊
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか
 * @param {Boolean} isRadarShooting レーダー射撃戦か(default=false)
 */
var AntiSubmarinePower = function (date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins, isRadarShooting) {
    this.date = date
    this.kind = kind
    this.friendCombinedKind = friendCombinedKind
    this.isEnemyCombined = isEnemyCombined
    this.attackNum = attackNum
    this.formation = formation
    this.attack = attack
    this.attacker = attacker
    this.defender = defender
    this.attackerHp = attackerHp
    this.items = getItems(attacker)
    this.shouldUseSkilled = shouldUseSkilled
    this.origins = origins
    this.isRadarShooting = !!isRadarShooting
    /**
     * キャップ値
     * ～2017/11/10 17:07?:100
     * 2017/11/10 17:07?～:150
     */
    this.CAP_VALUE = getJstDate(2017, 11, 10, 17, 7, 0).before(this.date) ? 150 : 100
}

/**
 * 対潜火力(基本攻撃力)を返します
 * @return {Number} 対潜火力(基本攻撃力)
 */
AntiSubmarinePower.prototype.getBasePower = function () {
    // レーダー射撃戦専用処理
    if (this.isRadarShooting) {
        return Math.sqrt(this.attacker.raisou) * 2
    }
    // フィットボーナス
    var equipmentBonus = function (date, attacker, items) {
        var BONUS_LIST = {
            // 大鷹
            526: {
                82: {param:1, date: getJstDate(2018, 8, 30, 18, 0, 0)},  // 九七式艦攻(九三一空)
                302: {param:1, date: getJstDate(2018, 8, 30, 18, 0, 0)}, // 九七式艦攻(九三一空/熟練)
                305: {param:1, date: getJstDate(2018, 8, 30, 18, 0, 0)}, // Ju87C改二(KMX搭載機)
                306: {param:1, date: getJstDate(2018, 8, 30, 18, 0, 0)}, // Ju87C改二(KMX搭載機／熟練)
            },
            380: 526, // 大鷹改
            529: 526, // 大鷹改二
            // 神鷹
            534: {
                82: 1,  // 九七式艦攻(九三一空)
                302: 1, // 九七式艦攻(九三一空/熟練)
                305: 3, // Ju87C改二(KMX搭載機)
                306: 3, // Ju87C改二(KMX搭載機／熟練)
            },
            // 神鷹改
            381: 534,
            // 神鷹改二
            536: 534,
            // 神風
            471: {
                47: {param: 3, date: getJstDate(2019, 1, 22, 12, 0, 0)} // 三式水中探信儀
            },
            476: 471, // 神風改
            473: 471, // 春風
            363: 471, // 春風改
            43: 471, // 時雨
            243: 471, // 時雨改
            145: 471, // 時雨改二
            457: 471, // 山風
            369: 471, // 山風改
            122: 471, // 舞風
            294: 471, // 舞風改
            425: 471, // 朝霜
            344: 471, // 朝霜改
            // 潮
            16: {
                47: {param: 2, date: getJstDate(2019, 1, 22, 12, 0, 0)} // 三式水中探信儀
            },
            233: 16, // 潮改
            407: 16, // 潮改二
            36: 16, // 雷
            236: 16, // 雷改
            414: 16, // 山雲
            328: 16, // 山雲改
            167: 16, // 磯風
            320: 16, // 磯風改
            557: 16, // 磯風乙改
            170: 16, // 浜風
            312: 16, // 浜風改
            558: 16, // 浜風乙改
            527: 16, // 岸波
            686: 16, // 岸波改
            // 伊勢改二
            553: {
                322: 1, // 瑞雲改二(六三四空)
                323: 2, // 瑞雲改二(六三四空/熟練)
                324: 1, // オ号観測機改
                325: 2, // オ号観測機改二
                326: 2, // S-51J
                327: 3, // S-51J改
            },
            // 日向改二
            554: {
                322: 1, // 瑞雲改二(六三四空)
                323: 2, // 瑞雲改二(六三四空/熟練)
                324: 1, // オ号観測機改
                325: 2, // オ号観測機改二
                326: 3, // S-51J
                327: 4, // S-51J改
            },
            ctype: {
                // 球磨型
                4: {
                    304: 1, // S9 Osprey
                },
                // 川内型
                16: 4,
                // 長良型
                20: 4,
                // 阿賀野型
                41: 4,
                // Gotland級
                89: {
                    304: 2, // S9 Osprey
                },
            },
        }
        if (BONUS_LIST[attacker.shipId]) {
            var bonus = isNaN(BONUS_LIST[attacker.shipId]) ? BONUS_LIST[attacker.shipId] : BONUS_LIST[BONUS_LIST[attacker.shipId]]
            return items.filter(function (item) {
                return bonus[item.slotitemId]
            }).filter(function (item) {
                return isNaN(bonus[item.slotitemId]) ? bonus[item.slotitemId].date.before(date) : true
            }).map(function (item) {
                return isNaN(bonus[item.slotitemId]) ? bonus[item.slotitemId].param : bonus[item.slotitemId]
            }).reduce(function (p, param) {
                return p + param
            }, 0)
        }
        else {
            var ctype = Ship.get(attacker.shipId).json.getJsonNumber("api_ctype").intValue()
            if (BONUS_LIST.ctype[ctype]) {
                var bonus = isNaN(BONUS_LIST.ctype[ctype]) ? BONUS_LIST.ctype[ctype] : BONUS_LIST.ctype[BONUS_LIST.ctype[ctype]]
                return items.filter(function (item) {
                    return bonus[item.slotitemId]
                }).filter(function (item) {
                    return isNaN(bonus[item.slotitemId]) ? bonus[item.slotitemId].date.before(date) : true
                }).map(function (item) {
                    return isNaN(bonus[item.slotitemId]) ? bonus[item.slotitemId].param : bonus[item.slotitemId]
                }).reduce(function (p, param) {
                    return p + param
                }, 0)
            }
        }
        return 0
    }(this.date, this.attacker, this.items)
    var taisenShip = this.attacker.taisen - this.attacker.slotParam.taisen - equipmentBonus
    var taisenItem = this.items.map(function (item) {
        switch (item.type2) {
            case 7:  // 艦上爆撃機
            case 8:  // 艦上攻撃機
            case 11: // 水上爆撃機
            case 14: // ソナー
            case 15: // 爆雷
            case 25: // オートジャイロ
            case 26: // 対潜哨戒機
            case 40: // 大型ソナー
                return item.param.taisen
            default:
                return 0
        }
    }).reduce(function (prev, current) {
        return prev + current
    }, 0)
    return Math.sqrt(taisenShip) * 2 + taisenItem * 1.5 + this.getImprovementBonus() + this.getShipTypeConstant()
}

/**
 * 対潜改修火力を返します
 * @return {Number} 対潜改修火力
 */
AntiSubmarinePower.prototype.getImprovementBonus = function () {
    return this.items.map(function (item) {
        switch (item.type2) {
            case 14: // ソナー
            case 15: // 爆雷
                return Math.sqrt(item.level)
            case 25: // 回転翼機
                return 0.3 * item.level
            default:
                return 0
        }
    }).reduce(function (prev, current) {
        return prev + current
    }, 0)
}

/**
 * 対潜艦種別定数を返します
 * @return {8|13} 対潜艦種別定数
 */
AntiSubmarinePower.prototype.getShipTypeConstant = function () {
    if (isSubMarine(this.defender)) {
        if (!this.attack.kind.isNight()) {
            if (getAttackTypeAtDay(this.attack, this.attacker, this.defender) === 1) {
                return 8
            } else {
                return 13
            }
        } else {
            if (getAttackTypeAtNight(this.attack, this.attacker, this.defender) === 1) {
                return 8
            } else {
                return 13
            }
        }
    } else {
        return 0
    }
}

/**
 * 対潜シナジー倍率を取得します
 * @return {Number} 対潜シナジー倍率
 */
AntiSubmarinePower.prototype.getSynergyBonus = function () {
    // 旧型シナジー
    var synergy1 = (this.items.some(function (item) { return item.type3 === 18 })
        && this.items.some(function (item) { return item.type3 === 17 })) ? 1.15 : 1
    // 新型シナジー
    var synergy2 = 1
    if (this.items.some(function (item) { return item.slotitemId === 44 || item.slotitemId === 45 })
        && this.items.some(function (item) { return item.slotitemId === 226 || item.slotitemId === 227 })) {
        if (this.items.some(function (item) { return item.type2 === 14 })) {
            // 小型ソナー/爆雷投射機/爆雷シナジー
            synergy2 = 1.25
        } else {
            // 爆雷投射機/爆雷シナジー
            synergy2 = 1.1
        }
    }
    return synergy1 * synergy2
}

/**
 * 対潜火力(キャップ前)を返します
 * @return {Number} 対潜火力(キャップ前)
 */
AntiSubmarinePower.prototype.getBeforeCapPower = function () {
    return this.getBasePower() * getFormationMatchBonus(this.formation) * this.getFormationBonus() * this.getConditionBonus() * this.getSynergyBonus()
}

/**
 * 対潜火力(キャップ後)を返します
 * @return {[Number,Number]} 対潜火力(キャップ後)
 */
AntiSubmarinePower.prototype.getAfterCapPower = function () {
    var v = Math.floor(getAfterCapValue(this.getBeforeCapPower(), this.CAP_VALUE)) * getCriticalBonus(this.attack)
    var s = this.shouldUseSkilled ? getSkilledBonus(this.date, this.attack, this.attacker, this.defender, this.attackerHp) : [1.0, 1.0]
    return [Math.floor(v * s[0]), Math.floor(v * s[1])]
}

/**
 * 対潜陣形補正を返します
 * @return {Number} 倍率
 */
AntiSubmarinePower.prototype.getFormationBonus = function () {
    var CHANGE_ECHELON_BONUS_DATE = getJstDate(2019, 2, 27, 12, 0, 0)
    switch (Number(this.formation[this.attack.friendAttack ? 0 : 1])) {
        case FORMATION.LINE_AHEAD: return 0.6
        case FORMATION.DOUBLE_LINE: return 0.8
        case FORMATION.DIAMOND: return 1.2
        case FORMATION.ECHELON: return CHANGE_ECHELON_BONUS_DATE.before(this.date) ? 1.1 : 1.0
        case FORMATION.LINE_ABREAST: return 1.3
        case FORMATION.VANGUARD: return this.attack.attacker < Math.floor(this.attackNum / 2) ? 1.0 : 0.6
        case FORMATION.CRUISING_FORMATION_1: return 1.3
        case FORMATION.CRUISING_FORMATION_2: return 1.1
        case FORMATION.CRUISING_FORMATION_3: return 1.0
        case FORMATION.CRUISING_FORMATION_4: return 0.7
        default: return 1.0
    }
}

/**
 * 損傷補正を返します
 * @return {Number} 倍率
 */
AntiSubmarinePower.prototype.getConditionBonus = function () {
    if (this.attackerHp.isBadlyDamage()) {
        return 0.4
    } else if (this.attackerHp.isHalfDamage()) {
        return 0.7
    } else {
        return 1.0
    }
}

//#endregion

//#region 昼砲撃関連

/**
 * 昼砲撃関連処理
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} attackNum 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか
 * @param {FleetDto} origins 攻撃側艦隊
 */
var DayBattlePower = function (date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    this.date = date
    this.kind = kind
    this.friendCombinedKind = friendCombinedKind
    this.isEnemyCombined = isEnemyCombined
    this.attackNum = attackNum
    this.formation = formation
    this.attack = attack
    this.attacker = attacker
    this.defender = defender
    this.attackerHp = attackerHp
    this.items = getItems(attacker)
    this.shouldUseSkilled = shouldUseSkilled
    this.origins = origins
    this.CAP_VALUE = getJstDate(2017, 3, 17, 12, 0, 0).before(this.date) ? 180 : 150
}

/**
 * 昼砲撃火力(基本攻撃力)を返します
 * @return {Number} 昼砲撃火力(基本攻撃力)
 */
DayBattlePower.prototype.getBasePower = function () {
    // 空撃または陸上型かつ艦上爆撃機,艦上攻撃機,陸上攻撃機,噴式戦闘爆撃機,噴式攻撃機所持時?
    if (getAttackTypeAtDay(this.attack, this.attacker, this.defender) === 1 || isGround(this.attacker) && this.items.some(function (item) { return item.type2 === 7 || item.type2 === 8 || item.type2 === 47 || item.type2 === 57 || item.type2 === 58 })) {
        // 空撃
        var rai = !isGround(this.defender) ? this.attacker.slotParam.raig : 0
        var baku = this.attacker.slotParam.baku
        return Math.floor((this.attacker.karyoku + rai + Math.floor(baku * 1.3) + this.getImprovementBonus() + this.getCombinedPowerBonus()) * 1.5) + 55
    } else {
        // 砲撃
        return this.attacker.karyoku + this.getImprovementBonus() + this.getCombinedPowerBonus() + 5
    }
}

/**
 * 昼砲撃改修火力を返します
 * @return {Number} 昼砲撃改修火力
 */
DayBattlePower.prototype.getImprovementBonus = function () {
    var CHANGE_SUB_GUN_BONUS_DATE = getJstDate(2017, 3, 17, 12, 0, 0)
    var RECHANGE_SUB_GUN_BONUS_DATE = getJstDate(2017, 5, 2, 12, 0, 0)
    return this.items.map(function (item) {
        var _getimprovementBonus = function () {
            switch (item.type2) {
                case 1: return 1        // 小口径主砲
                case 2: return 1        // 中口径主砲
                case 3: return 1.5      // 大口径主砲
                case 38: return 1.5     // 大口径主砲(II)
                case 4: return 1        // 副砲
                case 19: return 1       // 対艦強化弾
                case 36: return 1       // 高射装置
                case 29: return 1       // 探照灯
                case 42: return 1       // 大型探照灯
                case 21: return 1       // 機銃
                case 15:                // 爆雷(投射機)
                    return item.slotitemId === 44 || item.slotitemId === 45 ? 0.75 : 0
                case 14: return 0.75    // ソナー
                case 40: return 0.75    // 大型ソナー
                case 24: return 1       // 上陸用舟艇
                case 46: return 1       // 特二式内火艇
                case 18: return 1       // 三式弾
                default: return 0
            }
        }
        // 副砲
        if (item.type2 === 4) {
            // 2017/3/17～2017/5/2
            if (CHANGE_SUB_GUN_BONUS_DATE.before(this.date) && RECHANGE_SUB_GUN_BONUS_DATE.after(this.date)) {
                switch (item.type3) {
                    case 4: return 0.3 * item.level // (黄色)副砲
                    case 16: return 0.2 * item.level // (緑)高角副砲
                }
            } else {
                switch (item.slotitemId) {
                    case 10:  // 12.7cm連装高角砲
                    case 66:  // 8cm高角砲
                    case 220: // 8cm高角砲改＋増設機銃
                    case 275: // 10cm連装高角砲改＋増設機銃
                        return 0.2 * item.level
                    case 12:  // 15.5cm三連装副砲
                    case 234: // 15.5cm三連装副砲改
                    case 247: // 15.2cm三連装砲
                        return 0.3 * item.level
                }
            }
        }
        return _getimprovementBonus() * Math.sqrt(item.level)
    }, this).reduce(function (prev, current) {
        return prev + current
    }, 0)
}

/**
 * 昼砲撃火力(キャップ前)を返します
 * @return {Number} 昼砲撃火力(キャップ前)
 */
DayBattlePower.prototype.getBeforeCapPower = function () {
    var landBonus = getLandBonus(this.attacker, this.defender)
    return ((this.getBasePower() + landBonus.b12) * landBonus.multi + getWg42Bonus(this.attacker, this.defender) + landBonus.add) * getFormationMatchBonus(this.formation) * this.getFormationBonus() * this.getConditionBonus() + getOriginalGunPowerBonus(this.attacker)
}

/**
 * 昼砲撃火力(キャップ後)を返します
 * @return {[Number,Number]} 昼砲撃火力(キャップ後)
 */
DayBattlePower.prototype.getAfterCapPower = function () {
    // サイレント修正(Twitterで確認した限りでは17/9/9が最古=>17夏イベ?)以降、集積地棲姫特効のキャップ位置が変化(a5→a6)
    // 17夏以降に登場したPT小鬼群の特効位置もa6に変化?(乗算と加算組み合わせているっぽいので詳細不明)
    // A = [[キャップ後攻撃力] * 乗算特効補正 + 加算特効補正] * 弾着観測射撃 * 戦爆連合カットイン攻撃
    var value = Math.floor(Math.floor(getAfterCapValue(this.getBeforeCapPower(), this.CAP_VALUE)) * getMultiplySlayerBonus(this.attacker, this.defender) + getAddSlayerBonus(this.attacker, this.defender)) * this.getSpottingBonus() * this.getUnifiedBombingBonus()
    // 徹甲弾補正判定
    if (this.isAPshellBonusTarget()) {
        // A = [A * 徹甲弾補正]
        value = Math.floor(value * this.getAPshellBonus())
    }
    // クリティカル判定
    if (isCritical(this.attack)) {
        // A = [A * クリティカル補正 * 熟練度補正]
        value *= getCriticalBonus(this.attack)
        var skilled = this.shouldUseSkilled ? getSkilledBonus(this.date, this.attack, this.attacker, this.defender, this.attackerHp) : [1.0, 1.0]
        return [Math.floor(value * skilled[0]), Math.floor(value * skilled[1])]
    }
    return [value, value]
}

/**
 * 昼砲撃陣形補正を返します
 * @return {Number} 倍率
 */
DayBattlePower.prototype.getFormationBonus = function () {
    var CHANGE_ECHELON_BONUS_DATE = getJstDate(2019, 2, 27, 12, 0, 0)
    switch (Number(this.formation[this.attack.friendAttack ? 0 : 1])) {
        case FORMATION.LINE_AHEAD: return 1.0
        case FORMATION.DOUBLE_LINE: return 0.8
        case FORMATION.DIAMOND: return 0.7
        case FORMATION.ECHELON: return CHANGE_ECHELON_BONUS_DATE.before(this.date) ? 0.75 : 0.6
        case FORMATION.LINE_ABREAST: return 0.6
        case FORMATION.VANGUARD: return this.attack.attacker < Math.floor(this.attackNum / 2) ? 0.5 : 1.0
        case FORMATION.CRUISING_FORMATION_1: return 0.8
        case FORMATION.CRUISING_FORMATION_2: return 1.0
        case FORMATION.CRUISING_FORMATION_3: return 0.7
        case FORMATION.CRUISING_FORMATION_4: return 1.1
        default: return 1.0
    }
}

/**
 * 損傷補正を返します
 * @return {Number} 倍率
 */
DayBattlePower.prototype.getConditionBonus = function () {
    if (this.attackerHp.isBadlyDamage()) {
        return 0.4
    } else if (this.attackerHp.isHalfDamage()) {
        return 0.7
    } else {
        return 1.0
    }
}

/**
 * 徹甲弾補正を返す
 * @return {Number} 倍率
 */
DayBattlePower.prototype.getAPshellBonus = function () {
    if (this.isAPshellBonusTarget()) {
        var mainGun = this.items.some(function (item) { return item.type1 === 1 })
        var subGun = this.items.some(function (item) { return item.type1 === 2 })
        var apShell = this.items.some(function (item) { return item.type1 === 25 })
        var radar = this.items.some(function (item) { return item.type1 === 8 })
        if (mainGun && apShell) {
            if (subGun) return 1.15
            if (radar) return 1.1
            return 1.08
        }
    }
    return 1.0
}

/**
 * 徹甲弾補正対象か
 * @return {Boolean} 対象か
 */
DayBattlePower.prototype.isAPshellBonusTarget = function () {
    switch (this.defender.stype) {
        case 5:  // 重巡洋艦
        case 6:  // 航空巡洋艦
        case 8:  // 巡洋戦艦
        case 9:  // 戦艦
        case 10: // 航空戦艦
        case 11: // 正規空母
        case 12: // 超弩級戦艦
        case 18: // 装甲空母
            return true
        default:
            return false
    }
}

/**
 * 弾着補正を返す
 * @return {Number} 倍率
 */
DayBattlePower.prototype.getSpottingBonus = function () {
    var ADD_ITEM_BONUS_DATE = getJstDate(2018, 12, 7, 12, 0, 0)
    var UPDATE_SPECIAL_ATTACK_BONUS_DATE = getJstDate(2019, 2, 27, 12, 0, 0)

    switch (Number(this.attack.attackType)) {
        case 0: return 1.0   // 通常攻撃
        case 1: return 1.0   // レーザー攻撃
        case 2: return 1.2   // 連撃
        case 3: return 1.1   // 主砲+副砲
        case 4: return 1.2   // 主砲+電探
        case 5: return 1.3   // 主砲+徹甲弾
        case 6: return 1.5   // 主砲+主砲
        //case 7: return 1.0 // 戦爆連合CI
        case 100: return Number(this.formation[2]) === 4 ? 2.5 : 2.0 // Nelson Touch(≠弾着攻撃)
        case 101: // 一斉射かッ…胸が熱いな！
            var secondShipId = this.origins[this.attack.mainAttack ? "main" : "escort"][1].shipId
            var base = this.attack.attackNum < 3 ? 1.4 : 1.2
            var secondShipBonus = function(date, secondShipId, attackNum){
                if (attackNum < 3) {
                    switch (secondShipId) {
                        case 573: return 1.2  // 陸奥改二
                        case 276: return 1.15 // 陸奥改
                        case 576: return UPDATE_SPECIAL_ATTACK_BONUS_DATE.before(date) ? 1.1 : 1.0  // Nelson改
                    }
                } else {
                    switch (secondShipId) {
                        case 573: return 1.4  // 陸奥改二
                        case 276: return 1.35 // 陸奥改
                        case 576: return UPDATE_SPECIAL_ATTACK_BONUS_DATE.before(date) ? 1.25 : 1.0  // Nelson改
                    }
                }
                return 1.0
            }(this.date, secondShipId, this.attack.attackNum)
            var itemBonus = function(date, items) {
                if (ADD_ITEM_BONUS_DATE.after(date)) return 1
                var surfaceRadarBonus = items.some(function(item) {
                    return item.type3 === 11 && item.param.saku >= 5
                }) ? 1.15 : 1
                var apShellBonus = items.some(function(item) {
                    return item.type3 === 13
                }) ? 1.35 : 1
                return surfaceRadarBonus * apShellBonus
            }(this.date, !this.attack.lastAttack ? this.items : getItems(this.origins[this.attack.mainAttack ? "main" : "escort"][1]))
            return base * secondShipBonus * itemBonus
        case 102: // 長門、いい？ いくわよ！ 主砲一斉射ッ！
            var secondShipId = this.origins[this.attack.mainAttack ? "main" : "escort"][1].shipId
            var base = this.attack.attackNum < 3 ? 1.4 : 1.2
            var secondShipBonus = function(secondShipId, attackNum){
                if (attackNum < 3) {
                    switch (secondShipId) {
                        case 541: return 1.2 // 長門改二
                    }
                } else {
                    switch (secondShipId) {
                        case 541: return 1.4 // 長門改二
                    }
                }
                return 1.0
            }(secondShipId, this.attack.attackNum)
            var itemBonus = function(items) {
                var surfaceRadarBonus = items.some(function(item) {
                    return item.type3 === 11 && item.param.saku >= 5
                }) ? 1.15 : 1
                var apShellBonus = items.some(function(item) {
                    return item.type3 === 13
                }) ? 1.35 : 1
                return surfaceRadarBonus * apShellBonus
            }(!this.attack.lastAttack ? this.items : getItems(this.origins[this.attack.mainAttack ? "main" : "escort"][1]))
            return base * secondShipBonus * itemBonus
        case 103: // Colorado 特殊攻撃
            var secondShipId = this.origins[this.attack.mainAttack ? "main" : "escort"][1].shipId
            var thirdShipId = this.origins[this.attack.mainAttack ? "main" : "escort"][2].shipId
            var base = this.attack.attackNum === 1 ? 1.3 : 1.15
            var companionShipBonus = function (secondShipId, thirdShipId, attackNum) {
                var isBig7 = function(shipId){
                    switch (shipId) {
                        case 80:  // 長門
                        case 275: // 長門改
                        case 541: // 長門改二
                        case 81:  // 陸奥
                        case 276: // 陸奥改
                        case 573: // 陸奥改二
                        case 571: // Nelson
                        case 576: // Nelson改
                            return true
                    }
                    return false
                }

                switch (attackNum) {
                    case 2:
                        return isBig7(secondShipId) ? 1.1 : 1
                    case 3:
                        return isBig7(thirdShipId) ? 1.15 * (isBig7(secondShipId) ? 1.1 : 1) : 1
                }
                return 1
            }(secondShipId, thirdShipId)
            var itemBonus = function(items) {
                var surfaceRadarBonus = items.some(function(item) {
                    return item.type3 === 11 && item.param.saku >= 5
                }) ? 1.15 : 1
                var apShellBonus = items.some(function(item) {
                    return item.type3 === 13
                }) ? 1.35 : 1
                return surfaceRadarBonus * apShellBonus
            }(!this.attack.lastAttack ? this.items : getItems(this.origins[this.attack.mainAttack ? "main" : "escort"][1]))
            return base * companionShipBonus * itemBonus
        case 200: return 1.35 // 瑞雲立体攻撃
        case 201: return 1.3 // 海空立体攻撃
        default: return 1.0  // それ以外
    }
}

/**
 * 戦爆連合CI補正を返す
 * @return {Number} 倍率
 */
DayBattlePower.prototype.getUnifiedBombingBonus = function () {
    if (Number(this.attack.attackType) === 7) {
        var type2list = Java.from(this.attack.showItem).map(function (id) { return Item.get(Number(id)).type2 })
        var fighter = type2list.filter(function (type2) { return type2 === 6 }).length
        var bomber = type2list.filter(function (type2) { return type2 === 7 }).length
        var attacker = type2list.filter(function (type2) { return type2 === 8 }).length
        if (fighter === 1 && bomber === 1 && attacker === 1) {
            return 1.25
        } else if (bomber === 2 && attacker === 1) {
            return 1.2
        } else if (bomber === 1 && attacker === 1) {
            return 1.15
        }
    }
    return 1
}

/**
 * 連合艦隊補正を返す
 * @return {Number} 連合艦隊補正
 */
DayBattlePower.prototype.getCombinedPowerBonus = function () {
    if (this.attack.friendAttack) {
        if (this.isEnemyCombined) {
            switch (this.friendCombinedKind) {
                case COMBINED_FLEET.NONE:                // 味方:通常艦隊                        -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return 5
                case COMBINED_FLEET.CARRIER_TASK_FORCE:  // 味方:空母機動部隊(第一艦隊/第二艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return this.attack.mainAttack ? 2 : -5
                case COMBINED_FLEET.SURFACE_TASK_FORCE:  // 味方:水上打撃部隊(第一艦隊/第二艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return this.attack.mainAttack ? 2 : -5
                case COMBINED_FLEET.TRANSPORT_ESCORT:    // 味方:輸送護衛部隊(第一艦隊/第二艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return this.attack.mainAttack ? -5 : -5
            }
        } else {
            switch (this.friendCombinedKind) {
                case COMBINED_FLEET.NONE:                // 味方:通常艦隊                        -> 敵:通常艦隊
                    return 0
                case COMBINED_FLEET.CARRIER_TASK_FORCE:  // 味方:空母機動部隊(第一艦隊/第二艦隊) -> 敵:通常艦隊
                    return this.attack.mainAttack ? 2 : 10
                case COMBINED_FLEET.SURFACE_TASK_FORCE:  // 味方:水上打撃部隊(第一艦隊/第二艦隊) -> 敵:通常艦隊
                    return this.attack.mainAttack ? 10 : -5
                case COMBINED_FLEET.TRANSPORT_ESCORT:    // 味方:輸送護衛部隊(第一艦隊/第二艦隊) -> 敵:通常艦隊
                    return this.attack.mainAttack ? -5 : 10
            }
        }
    } else {
        if (this.isEnemyCombined) {
            return this.attack.mainAttack ? 10 : -5     // 敵:空母機動部隊(第一艦隊/第二艦隊) -> 味方:Any
        } else {
            switch (this.friendCombinedKind) {
                case COMBINED_FLEET.NONE:               // 敵:通常艦隊 -> 味方:通常艦隊
                    return 0
                case COMBINED_FLEET.CARRIER_TASK_FORCE: // 敵:通常艦隊 -> 味方:空母機動部隊(第一艦隊/第二艦隊)
                    return this.attack.mainDefense ? 10 : 5
                case COMBINED_FLEET.SURFACE_TASK_FORCE: // 敵:通常艦隊 -> 味方:水上打撃部隊(第一艦隊/第二艦隊)
                    return this.attack.mainDefense ? 5 : -5
                case COMBINED_FLEET.TRANSPORT_ESCORT:   // 敵:通常艦隊 -> 味方:輸送護衛部隊(第一艦隊/第二艦隊)
                    return this.attack.mainDefense ? 10 : 5
            }
        }
    }
    return 0
}

//#endregion

//#region 雷撃関連

/**
 * 雷撃関連処理
 * @param {java.util.Date} date 戦闘日時
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} attackNum 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 */
var TorpedoPower = function (date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, attack, attacker, defender, attackerHp) {
    this.date = date
    this.friendCombinedKind = friendCombinedKind
    this.isEnemyCombined = isEnemyCombined
    this.attackNum = attackNum
    this.formation = formation
    this.attack = attack
    this.attacker = attacker
    this.defender = defender
    this.attackerHp = attackerHp
    this.items = getItems(attacker)
    this.CAP_VALUE = 150
}

/**
 * 雷撃火力(基本攻撃力)を返します
 * @return {Number} 雷撃火力(基本攻撃力)
 */
TorpedoPower.prototype.getBasePower = function () {
    return this.attacker.raisou + this.getImprovementBonus() + this.getCombinedPowerBonus() + 5
}

/**
 * 雷撃改修火力を返します
 * @return {Number} 雷撃改修火力
 */
TorpedoPower.prototype.getImprovementBonus = function () {
    return this.items.map(function (item) {
        switch (item.type2) {
            case 5: // 魚雷
            case 21: // 機銃
            case 32: // 潜水艦魚雷
                return 1.2 * Math.sqrt(item.level)
            default:
                return 0
        }
    }, this).reduce(function (prev, current) {
        return prev + current
    }, 0)
}

/**
 * 雷撃火力(キャップ前)を返します
 * @return {Number} 雷撃火力(キャップ前)
 */
TorpedoPower.prototype.getBeforeCapPower = function () {
    return this.getBasePower() * getFormationMatchBonus(this.formation) * this.getFormationBonus() * this.getConditionBonus()
}

/**
 * 雷撃火力(キャップ後)を返します
 * @return {[Number,Number]} 雷撃火力(キャップ後)
 */
TorpedoPower.prototype.getAfterCapPower = function () {
    var result = [0, 0]
    var value = getAfterCapValue(this.getBeforeCapPower(), this.CAP_VALUE)
    var critical = getCriticalBonus(this.attack)
    result[0] = result[1] = Math.floor(Math.floor(value) * critical)
    return result
}

/**
 * 雷撃陣形補正を返します
 * @return {Number} 倍率
 */
TorpedoPower.prototype.getFormationBonus = function () {
    switch (Number(this.formation[this.attack.friendAttack ? 0 : 1])) {
        case FORMATION.LINE_AHEAD: return 1.0
        case FORMATION.DOUBLE_LINE: return 0.8
        case FORMATION.DIAMOND: return 0.7
        case FORMATION.ECHELON: return 0.6
        case FORMATION.LINE_ABREAST: return 0.6
        case FORMATION.VANGUARD: return 1.0
        case FORMATION.CRUISING_FORMATION_1: return 0.7
        case FORMATION.CRUISING_FORMATION_2: return 0.9
        case FORMATION.CRUISING_FORMATION_3: return 0.6
        case FORMATION.CRUISING_FORMATION_4: return 1.0
        default: return 1.0
    }
}

/**
 * 損傷補正を返します
 * @return {Number} 倍率
 */
TorpedoPower.prototype.getConditionBonus = function () {
    if (this.attackerHp.isBadlyDamage()) {
        return 0
    } else if (this.attackerHp.isHalfDamage()) {
        return 0.8
    } else {
        return 1.0
    }
}

/**
 * 連合艦隊補正を返す
 * @return {Number} 連合艦隊補正
 */
TorpedoPower.prototype.getCombinedPowerBonus = function () {
    if (this.attack.friendAttack) {
        if (this.isEnemyCombined) {
            switch (this.friendCombinedKind) {
                case COMBINED_FLEET.NONE:                // 味方:通常艦隊               -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return 10
                case COMBINED_FLEET.CARRIER_TASK_FORCE:  // 味方:空母機動部隊(第二艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return 10
                case COMBINED_FLEET.SURFACE_TASK_FORCE:  // 味方:水上打撃部隊(第二艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return 10
                case COMBINED_FLEET.TRANSPORT_ESCORT:    // 味方:輸送護衛部隊(第二艦隊) -> 敵:空母機動部隊(第一艦隊/第二艦隊)
                    return 10
            }
        } else {
            switch (this.friendCombinedKind) {
                case COMBINED_FLEET.NONE:                // 味方:通常艦隊               -> 敵:通常艦隊
                    return 0
                case COMBINED_FLEET.CARRIER_TASK_FORCE:  // 味方:空母機動部隊(第二艦隊) -> 敵:通常艦隊
                    return -5
                case COMBINED_FLEET.SURFACE_TASK_FORCE:  // 味方:水上打撃部隊(第二艦隊) -> 敵:通常艦隊
                    return -5
                case COMBINED_FLEET.TRANSPORT_ESCORT:    // 味方:輸送護衛部隊(第二艦隊) -> 敵:通常艦隊
                    return -5
            }
        }
    } else {
        if (this.isEnemyCombined) {
            return 5                                    // 敵:空母機動部隊(第二艦隊) -> 味方:Any
        } else {
            switch (this.friendCombinedKind) {
                case COMBINED_FLEET.NONE:               // 敵:通常艦隊 -> 味方:通常艦隊
                    return 0
                case COMBINED_FLEET.CARRIER_TASK_FORCE: // 敵:通常艦隊 -> 味方:空母機動部隊(第一艦隊/第二艦隊)
                    return -5
                case COMBINED_FLEET.SURFACE_TASK_FORCE: // 敵:通常艦隊 -> 味方:水上打撃部隊(第一艦隊/第二艦隊)
                    return -5
                case COMBINED_FLEET.TRANSPORT_ESCORT:   // 敵:通常艦隊 -> 味方:輸送護衛部隊(第一艦隊/第二艦隊)
                    return -5
            }
        }
    }
    return 0
}

//#endregion

//#region 夜戦関連

/**
 * 夜戦関連処理
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} attackNum 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {[Number,Number]} touchPlane 夜間触接
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか
 * @param {FleetDto} origins 攻撃側艦隊
 */
var NightBattlePower = function (date, kind, friendCombinedKind, isEnemyCombined, attackNum, formation, touchPlane, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    this.date = date
    this.kind = kind
    this.friendCombinedKind = friendCombinedKind
    this.isEnemyCombined = isEnemyCombined
    this.attackNum = attackNum
    this.formation = formation
    this.touchPlane = touchPlane
    this.attack = attack
    this.attacker = attacker
    this.defender = defender
    this.attackerHp = attackerHp
    this.items = getItems(attacker)
    this.shouldUseSkilled = shouldUseSkilled
    this.origins = origins
    this.CAP_VALUE = 300
}

/**
 * 夜戦火力(基本攻撃力)を返します
 * @return {Number} 夜戦火力(基本攻撃力)
 */
NightBattlePower.prototype.getBasePower = function () {
    var useRaisou = !isGround(this.defender) || isNorthernmostLandingPrincess(this.defender) || this.items.length === 0
    // 夜襲
    if (isNightCvAttack(this.attacker, this.attackerHp)) {
        // フィットボーナス
        var equipmentBonus = function (date, attacker, items) {
            var BONUS_LIST = {
                // Aquila改
                365: {
                    // Re.2001 OR改
                    184: 1,
                    // Re.2001 G改
                    188: 3,
                    // Re.2001 CB改
                    316: 4,
                },
                // 飛龍改二
                196: {
                    // 二式艦上偵察機
                    61: [0, 3, 3, 3, 4, 4, 4, 4, 5, 5, 6],
                    // 九七式艦攻(友永隊)
                    93: {param: 3, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 天山一二型(友永隊)
                    94: {param: 7, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 九九式艦爆(江草隊)
                    99: {param: 1, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 彗星(江草隊)
                    100: {param: 3, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 彗星一二型(三一号光電管爆弾搭載機)
                    320: {param: 3, count: 1},
                },
                // 蒼龍改二
                197: {
                    // 二式艦上偵察機
                    61: [0, 3, 3, 3, 4, 4, 4, 4, 5, 5, 6],
                    // 九七式艦攻(友永隊)
                    93: {param: 1, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 天山一二型(友永隊)
                    94: {param: 3, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 九九式艦爆(江草隊)
                    99: {param: 4, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 彗星(江草隊)
                    100: {param: 6, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 彗星一二型(三一号光電管爆弾搭載機)
                    320: {param: 3, count: 1},
                },
                // Aquila
                444: 365,
                // 鈴谷航改二
                508: {
                    // 二式艦上偵察機
                    61: [0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3],
                    // 彗星一二型(三一号光電管爆弾搭載機)
                    320: {param: 4, count: 1},
                },
                // 熊野航改二
                509: 508,
                // 瑞鳳改二乙
                560: 508,
                // 蒼龍
                90: {
                    // 九七式艦攻(友永隊)
                    93: {param: 1, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 九九式艦爆(江草隊)
                    99: {param: 4, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                },
                // 飛龍
                91: {
                    // 九七式艦攻(友永隊)
                    93: {param: 3, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 九九式艦爆(江草隊)
                    99: {param: 1, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                },
                // 蒼龍改
                279: 99,
                // 飛龍改
                280: 91,
                // 翔鶴
                110: {
                    // 九七式艦攻(村田隊)
                    143: {param: 2, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 天山(村田隊)
                    144: {param: 2, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                },
                // 翔鶴改
                288: 110,
                // 翔鶴改二
                461: {
                    // 九七式艦攻(村田隊)
                    143: {param: 2, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 天山(村田隊)
                    144: {param: 4, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 流星改(一航戦)
                    342: {param: 1, count: 1},
                    // 流星改(一航戦/熟練)
                    343: {param: 1, count: 1},
                },
                // 翔鶴改二甲
                466: 461,
                // 瑞鶴
                111: {
                    // 九七式艦攻(村田隊)
                    143: {param: 1, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 天山(村田隊)
                    144: {param: 1, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                },
                // 瑞鶴改
                112: 111,
                // 瑞鶴改二
                462: {
                    // 九七式艦攻(村田隊)
                    143: {param: 1, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 天山(村田隊)
                    144: {param: 2, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 流星改(一航戦)
                    342: {param: 1, count: 1},
                    // 流星改(一航戦/熟練)
                    343: {param: 1, count: 1},
                },
                // 瑞鶴改二甲
                467: 462,
                // 赤城改
                277: {
                    // 流星
                    18: {param: 1, count: 1, date: getJstDate(2019, 5, 20, 12, 0, 0)},
                    // 流星改
                    52: {param: 1, count: 1, date: getJstDate(2019, 5, 20, 12, 0, 0)},
                    // 九七式艦攻(村田隊)
                    143: {param: 3, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 天山(村田隊)
                    144: {param: 3, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 烈風改二
                    336: {param: 1, count: 1},
                    // 烈風改二戊型
                    338: 1,
                    // 烈風改二戊型(一航戦/熟練)
                    339: {param: 1, count: 1},
                    // 流星改(一航戦)
                    342: {param: 1, count: 1},
                    // 流星改(一航戦/熟練)
                    343: {param: 2, count: 1},
                },
                // 赤城改二
                594: {
                    // 流星
                    18: {param: 1, count: 1},
                    // 流星改
                    52: {param: 1, count: 1},
                    // 九七式艦攻(村田隊)
                    143: {param: 3, count: 1},
                    // 天山(村田隊)
                    144: {param: 3, count: 1},
                    // 天山(村田隊)
                    144: {param: 3, count: 1},
                    // 烈風改二
                    336: {param: 1, count: 1},
                    // 烈風改二戊型
                    338: 1,
                    // 烈風改二戊型(一航戦/熟練)
                    339: {param: 1, count: 1},
                    // 流星改(一航戦)
                    342: {param: 2, count: 1},
                    // 流星改(一航戦/熟練)
                    343: {param: 3, count: 1},
                },
                // 赤城改二戊
                599: {
                    // 流星
                    18: {param: 2, count: 1},
                    // 流星改
                    52: {param: 2, count: 1},
                    // 九七式艦攻(村田隊)
                    143: {param: 3, count: 1},
                    // 天山(村田隊)
                    144: {param: 3, count: 1},
                    // 天山(村田隊)
                    144: {param: 3, count: 1},
                    // 烈風改二
                    336: {param: 1, count: 1},
                    // 烈風改二戊型
                    338: 4,
                    // 烈風改二戊型(一航戦/熟練)
                    339: {param: 6, count: 1},
                    // 流星改(一航戦)
                    342: {param: 3, count: 1},
                    // 流星改(一航戦/熟練)
                    343: {param: 5, count: 1},
                },
                // 加賀改
                278: {
                    // 流星
                    18: {param: 1, count: 1, date: getJstDate(2019, 5, 20, 12, 0, 0)},
                    // 流星改
                    52: {param: 1, count: 1, date: getJstDate(2019, 5, 20, 12, 0, 0)},
                    // 九七式艦攻(村田隊)
                    143: {param: 2, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 天山(村田隊)
                    144: {param: 2, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 烈風改二
                    336: {param: 1, count: 1},
                    // 烈風改二戊型
                    338: 1,
                    // 烈風改二戊型(一航戦/熟練)
                    339: {param: 1, count: 1},
                    // 流星改(一航戦)
                    342: {param: 1, count: 1},
                    // 流星改(一航戦/熟練)
                    343: {param: 2, count: 1},
                },
                // 龍驤改二
                157: {
                    // 九七式艦攻(村田隊)
                    143: {param: 1, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                    // 天山(村田隊)
                    144: {param: 1, count: 1, date: getJstDate(2019, 4, 30, 21, 0, 0)},
                },
                // 大鳳改
                156: {
                    // 流星
                    18: {param: 1, count: 1, date: getJstDate(2019, 5, 20, 12, 0, 0)},
                    // 流星改
                    52: {param: 1, count: 1, date: getJstDate(2019, 5, 20, 12, 0, 0)},
                },
                stype : {
                    // 軽空母
                    7: {
                        // 二式艦上偵察機
                        61: [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2],
                    },
                    // 正規空母
                    11: 7,
                    // 装甲空母
                    18: {
                        // 二式艦上偵察機
                        61: [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2],
                        // 試製景雲(艦偵型)
                        151: [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2],
                    },
                }
            }

            /**
             * 連想配列か
             * @param {Any} o アイテム
             * @return {Boolean} 連想配列か
             */
            var isObject = function (o) {
                return (o instanceof Object && !(o instanceof Array))
            }

            // polyfill
            if (typeof Object.assign != 'function') {
                // Must be writable: true, enumerable: false, configurable: true
                Object.defineProperty(Object, "assign", {
                    value: function assign(target, varArgs) { // .length of function is 2
                        if (target == null) { // TypeError if undefined or null
                            throw new TypeError('Cannot convert undefined or null to object')
                        }

                        var to = Object(target)

                        for (var index = 1; index < arguments.length; index++) {
                            var nextSource = arguments[index]

                            if (nextSource != null) { // Skip over if undefined or null
                                for (var nextKey in nextSource) {
                                    // Avoid bugs when hasOwnProperty is shadowed
                                    if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                                        to[nextKey] = nextSource[nextKey]
                                    }
                                }
                            }
                        }
                        return to
                    },
                    writable: true,
                    configurable: true
                })
            }

            var bonus = {}
            if(BONUS_LIST.stype[attacker.stype]) {
                var tmp = isNaN(BONUS_LIST.stype[attacker.stype]) ? BONUS_LIST.stype[attacker.stype] : BONUS_LIST.stype[BONUS_LIST.stype[attacker.stype]]
                Object.assign(bonus, tmp)
            }
            if (BONUS_LIST[attacker.shipId]) {
                var tmp = isNaN(BONUS_LIST[attacker.shipId]) ? BONUS_LIST[attacker.shipId] : BONUS_LIST[BONUS_LIST[attacker.shipId]]
                Object.assign(bonus, tmp)
            }
            var counts = {}
            return items.filter(function (item) {
                return bonus[item.slotitemId]
            }).filter(function (item) {
                return isObject(bonus[item.slotitemId]) && bonus[item.slotitemId].date ? bonus[item.slotitemId].date.before(date) : true
            }).map(function (item) {
                if (Array.isArray(bonus[item.slotitemId])) {
                    return bonus[item.slotitemId][item.level]
                }
                if (isNaN(bonus[item.slotitemId])) {
                    counts[item.slotitemId] = (counts[item.slotitemId] | 0) + 1
                    if (!bonus[item.slotitemId].count && bonus[item.slotitemId].count > counts[item.slotitemId]) return 0
                    if (Array.isArray(bonus[item.slotitemId].param)) {
                        return bonus[item.slotitemId].param[item.level]
                    }
                    return bonus[item.slotitemId].param
                }
                return bonus[item.slotitemId]
            }).reduce(function (p, param) {
                return p + param
            }, 0)
        }(this.date, this.attacker, this.items)
        var karyoku = this.attacker.karyoku - this.attacker.slotParam.karyoku - equipmentBonus
        var nightPlaneBonus = this.items.map(function (item, i) {
            if (item !== null && getOnSlot(this.attacker, this.date)[i] > 0) {
                // 夜戦、夜攻
                if (item.type3 === 45 || item.type3 === 46) {
                    // 火力+雷装+3*機数+0.45*(火力+雷装+爆装+対潜)*sqrt(機数)*sqrt(★)
                    return item.param.karyoku + (useRaisou ? item.param.raisou : 0) + 3 * getOnSlot(this.attacker, this.date)[i] + 0.45 * (item.param.karyoku + item.param.raisou + item.param.baku + item.param.taisen) * Math.sqrt(getOnSlot(this.attacker, this.date)[i]) + Math.sqrt(item.level)
                } else {
                    switch (item.slotitemId) {
                        case 154: // 零戦62型(爆戦/岩井隊)
                        case 242: // Swordfish
                        case 243: // Swordfish Mk.II(熟練)
                        case 244: // Swordfish Mk.III(熟練)
                        case 320: // 彗星一二型(三一号光電管爆弾搭載機)
                            // 火力+雷装+0.3*(火力+雷装+爆装+対潜)*sqrt(機数)*sqrt(★)
                            return item.param.karyoku + item.param.raisou + 0.3 * (item.param.karyoku + item.param.raisou + item.param.baku + item.param.taisen) * Math.sqrt(getOnSlot(this.attacker, this.date)[i]) + Math.sqrt(item.level)
                    }
                }
            }
            return 0
        }, this).reduce(function (p, c) { return p + c }, 0)
        return karyoku + nightPlaneBonus + this.getNightTouchPlaneBonus()
    } else {
        // Ark Royal、Ark Royal改
        if (this.attacker.shipId === 393 || this.attacker.shipId === 515) {
            return this.attacker.karyoku
                - this.attacker.slotParam.karyoku
                + this.items.map(function (item) {
                    switch (item.slotitemId) {
                        case 242: // Swordfish
                        case 243: // Swordfish Mk.II(熟練)
                        case 244: // Swordfish Mk.III(熟練)
                            return item.param.karyoku + (useRaisou ? item.param.raisou : 0)
                    }
                    return 0
                }).reduce(function (p, c) { return p + c }, 0)
        }
        return this.attacker.karyoku + (useRaisou ? this.attacker.raisou : 0) + this.getImprovementBonus() + this.getNightTouchPlaneBonus()
    }
}

/**
 * 夜戦改修火力を返します
 * @return {Number} 夜戦改修火力
 */
NightBattlePower.prototype.getImprovementBonus = function () {
    var CHANGE_SUB_GUN_BONUS_DATE = getJstDate(2017, 3, 17, 12, 0, 0)
    var RECHANGE_SUB_GUN_BONUS_DATE = getJstDate(2017, 5, 2, 12, 0, 0)
    return this.items.map(function (item) {
        var _getimprovementBonus = function () {
            switch (item.type2) {
                case 1: return 1  // 小口径主砲
                case 2: return 1  // 中口径主砲
                case 3: return 1  // 大口径主砲
                case 38: return 1 // 大口径主砲(II)
                case 4: return 1  // 副砲
                case 19: return 1 // 対艦強化弾
                case 36: return 1 // 高射装置
                case 29: return 1 // 探照灯
                case 42: return 1 // 大型探照灯
                case 5: return 1  // 魚雷
                case 22: return 1 // 特殊潜航艇
                case 24: return 1 // 上陸用舟艇
                case 46: return 1 // 特二式内火艇
                case 18: return 1 // 三式弾
                default: return 0
            }
        }
        // 2017/3/17～2017/5/2
        if (CHANGE_SUB_GUN_BONUS_DATE.after(this.date) && RECHANGE_SUB_GUN_BONUS_DATE.before(this.date)) {
            switch (item.type3) {
                case 4: return 0.3 * item.level // 副砲
                case 16: return 0.2 * item.level // 高角副砲
            }
        } else {
            switch (item.slotitemId) {
                case 10:  // 12.7cm連装高角砲
                case 66:  // 8cm高角砲
                case 220: // 8cm高角砲改＋増設機銃
                case 275: // 10cm連装高角砲改＋増設機銃
                    return 0.2 * item.level
                case 12:  // 15.5cm三連装副砲
                case 234: // 15.5cm三連装副砲改
                    return 0.3 * item.level
            }
        }
        return _getimprovementBonus() * Math.sqrt(item.level)
    }, this).reduce(function (prev, current) {
        return prev + current
    }, 0)
}

/**
 * 夜戦陣形補正を返します
 * @return {Number} 倍率
 */
NightBattlePower.prototype.getFormationBonus = function () {
    switch (Number(this.formation[this.attack.friendAttack ? 0 : 1])) {
        case FORMATION.VANGUARD: return this.attack.attacker < Math.floor(this.attackNum / 2) ? 0.5 : 1.0
        default: return 1.0
    }
}

/**
 * 夜戦火力(キャップ前)を返します
 * @return {Number} 夜戦火力(キャップ前)
 */
NightBattlePower.prototype.getBeforeCapPower = function () {
    var landBonus = getLandBonus(this.attacker, this.defender)
    return ((this.getBasePower() + landBonus.b12) * landBonus.multi + getWg42Bonus(this.attacker, this.defender) + landBonus.add) * this.getFormationBonus() * this.getCutinBonus() * this.getConditionBonus() + getOriginalGunPowerBonus(this.attacker)
}

/**
 * 夜戦火力(キャップ後)を返します
 * @return {[Number,Number]} 夜戦火力(キャップ後)
 */
NightBattlePower.prototype.getAfterCapPower = function () {
    // A = [[キャップ後攻撃力] * 乗算特効補正 + 加算特効補正]
    var value = Math.floor(Math.floor(getAfterCapValue(this.getBeforeCapPower(), this.CAP_VALUE)) * getMultiplySlayerBonus(this.attacker, this.defender) + getAddSlayerBonus(this.attacker, this.defender))
    // クリティカル判定
    if (isCritical(this.attack)) {
        // A = [A * クリティカル補正 * 熟練度補正]
        value *= getCriticalBonus(this.attack)
        var skilled = this.shouldUseSkilled ? getSkilledBonus(this.date, this.attack, this.attacker, this.defender, this.attackerHp) : [1.0, 1.0]
        return [Math.floor(value * skilled[0]), Math.floor(value * skilled[1])]
    }
    return [value, value]
}

/**
 * カットイン攻撃補正を返します
 * @return {Number} 倍率
 */
NightBattlePower.prototype.getCutinBonus = function () {
    var ADD_ITEM_BONUS_DATE = getJstDate(2018, 12, 7, 12, 0, 0)
    var UPDATE_SPECIAL_ATTACK_BONUS_DATE = getJstDate(2019, 2, 27, 12, 0, 0)

    /**
     * 駆逐専用CI:12.7cm連装砲D型改二ボーナスを返します
     * @return {Number} 倍率
     */
    var dTypeGunBonus = function (items) {
        var num = items.filter(function (item) { return item.slotitemId === 267 }).length
        switch (num) {
            case 1: return 1.25
            case 2: return 1.4
        }
        return 1
    }(this.items)

    switch (Number(this.attack.attackType)) {
        case 1: return 1.2  // 連撃
        case 2: return 1.3  // カットイン(主砲/魚雷)
        case 3:
            if (Java.from(this.attack.showItem).filter(function (id) { return Number(id) === 213 || Number(id) === 214 }).length >= 1
                && Java.from(this.attack.showItem).filter(function (id) { return Number(id) === 210 || Number(id) === 211 }).length >= 1) {
                return 1.75  // カットイン(後魚/潜電)
            }
            if (Java.from(this.attack.showItem).filter(function (id) { return Number(id) === 213 || Number(id) === 214 }).length >= 2) {
                return 1.6  // カットイン(後魚/後魚)
            }
            return 1.5      // カットイン(魚雷/魚雷)
        case 4: return 1.75 // カットイン(主砲/副砲)
        case 5: return 2.0  // カットイン(主砲/主砲)
        case 6:             // 夜襲カットイン
            var items = Java.from(this.attack.showItem).map(function (id) { return Item.get(Number(id)) })
            // 夜間戦闘機
            var kind1 = items.filter(function (item) { return item.type3 === 45 }).length
            // 夜間攻撃機
            var kind2 = items.filter(function (item) { return item.type3 === 46 }).length
            // その他(SF,岩井,彗星(31号))
            var kind3 = items.map(function (item) { return item.slotitemId }).filter(function (id) { return [154,242,243,244,320].indexOf(id) >= 0 }).length
            var kind = kind1 * 100 + kind2 * 10 + kind3
            if (kind === 210) return 1.25
            if ([110, 101, 11].indexOf(kind) >= 0) return 1.2
            if ([300, 111, 201, 102].indexOf(kind) >= 0) return 1.18
            return 1.0
        case 7:             // 駆逐カットイン(主砲/魚雷/電探)
            return 1.3 * dTypeGunBonus
        case 8:             // 駆逐カットイン(魚雷/見張員/電探)
            return 1.2 * dTypeGunBonus
        case 100:           // Nelson Touch
            return Number(this.formation[2]) === 4 ? 2.5 : 2.0
        case 101: // 一斉射かッ…胸が熱いな！
            var secondShipId = this.origins[this.attack.mainAttack ? "main" : "escort"][1].shipId
            var base = this.attack.attackNum < 3 ? 1.4 : 1.2
            var secondShipBonus = function(date, secondShipId, attackNum){
                if (attackNum < 3) {
                    switch (secondShipId) {
                        case 573: return 1.2  // 陸奥改二
                        case 276: return 1.15 // 陸奥改
                        case 576: return UPDATE_SPECIAL_ATTACK_BONUS_DATE.before(date) ? 1.1 : 1.0  // Nelson改
                    }
                } else {
                    switch (secondShipId) {
                        case 573: return 1.4  // 陸奥改二
                        case 276: return 1.35 // 陸奥改
                        case 576: return UPDATE_SPECIAL_ATTACK_BONUS_DATE.before(date) ? 1.25 : 1.0  // Nelson改
                    }
                }
                return 1.0
            }(this.date, secondShipId, this.attack.attackNum)
            var itemBonus = function(date, items) {
                if (ADD_ITEM_BONUS_DATE.after(date)) return 1
                var surfaceRadarBonus = items.some(function(item) {
                    return item.type3 === 11 && item.param.saku >= 5
                }) ? 1.15 : 1
                var apShellBonus = items.some(function(item) {
                    return item.type3 === 13
                }) ? 1.35 : 1
                return surfaceRadarBonus * apShellBonus
            }(this.date, !this.attack.lastAttack ? this.items : getItems(this.origins[this.attack.mainAttack ? "main" : "escort"][1]))
            return base * secondShipBonus * itemBonus
        case 102: // 長門、いい？ いくわよ！ 主砲一斉射ッ！
            var secondShipId = this.origins[this.attack.mainAttack ? "main" : "escort"][1].shipId
            var base = this.attack.attackNum < 3 ? 1.4 : 1.2
            var secondShipBonus = function(secondShipId, attackNum){
                if (attackNum < 3) {
                    switch (secondShipId) {
                        case 541: return 1.2 // 長門改二
                    }
                } else {
                    switch (secondShipId) {
                        case 541: return 1.4 // 長門改二
                    }
                }
                return 1.0
            }(secondShipId, this.attack.attackNum)
            var itemBonus = function(items) {
                var surfaceRadarBonus = items.some(function(item) {
                    return item.type3 === 11 && item.param.saku >= 5
                }) ? 1.15 : 1
                var apShellBonus = items.some(function(item) {
                    return item.type3 === 13
                }) ? 1.35 : 1
                return surfaceRadarBonus * apShellBonus
            }(!this.attack.lastAttack ? this.items : getItems(this.origins[this.attack.mainAttack ? "main" : "escort"][1]))
            return base * secondShipBonus * itemBonus
        case 103: // Colorado 特殊攻撃
            var secondShipId = this.origins[this.attack.mainAttack ? "main" : "escort"][1].shipId
            var thirdShipId = this.origins[this.attack.mainAttack ? "main" : "escort"][2].shipId
            var base = this.attack.attackNum === 1 ? 1.3 : 1.15
            var companionShipBonus = function (secondShipId, thirdShipId, attackNum) {
                var isBig7 = function(shipId){
                    switch (shipId) {
                        case 80:  // 長門
                        case 275: // 長門改
                        case 541: // 長門改二
                        case 81:  // 陸奥
                        case 276: // 陸奥改
                        case 573: // 陸奥改二
                        case 571: // Nelson
                        case 576: // Nelson改
                            return true
                    }
                    return false
                }

                switch (attackNum) {
                    case 2:
                        return isBig7(secondShipId) ? 1.1 : 1
                    case 3:
                        return isBig7(thirdShipId) ? 1.15 * (isBig7(secondShipId) ? 1.1 : 1) : 1
                }
                return 1
            }(secondShipId, thirdShipId)
            var itemBonus = function(items) {
                var surfaceRadarBonus = items.some(function(item) {
                    return item.type3 === 11 && item.param.saku >= 5
                }) ? 1.15 : 1
                var apShellBonus = items.some(function(item) {
                    return item.type3 === 13
                }) ? 1.35 : 1
                return surfaceRadarBonus * apShellBonus
            }(!this.attack.lastAttack ? this.items : getItems(this.origins[this.attack.mainAttack ? "main" : "escort"][1]))
            return base * companionShipBonus * itemBonus
        case 200: return 1.35 // 瑞雲立体攻撃
        case 201: return 1.3 // 海空立体攻撃
        default: return 1.0
    }
}

/**
 * 損傷補正を返します
 * @return {Number} 倍率
 */
NightBattlePower.prototype.getConditionBonus = function () {
    if (this.attackerHp.isBadlyDamage()) {
        return 0.4
    } else if (this.attackerHp.isHalfDamage()) {
        return 0.7
    } else {
        return 1.0
    }
}

/**
 * 夜間触接補正を返します
 * @return {0|5} 夜間触接補正
 */
NightBattlePower.prototype.getNightTouchPlaneBonus = function () {
    return Number(this.touchPlane[this.attack.friendAttack ? 0 : 1]) > 0 ? 5 : 0
}

//#endregion

//#region 全般使用系

/**
 * スロットを返す
 * @param {logbook.dto.ShipDto} attacker 攻撃艦
 * @param {java.util.Date} date 戦闘日時
 * @return {[Number]} スロット
 */
function getOnSlot(attacker, date) {
    if (isAkakari) {
        try {
            AkakariSyutsugekiLogReader = Java.type("logbook.builtinscript.akakariLog.AkakariSyutsugekiLogReader")
            var json = AkakariSyutsugekiLogReader.shipAfterBattle(date, attacker.id) || AkakariSyutsugekiLogReader.shipEndPort(date, attacker.id)
            if (json) {
                return JSON.parse(json.get("api_onslot"))
            }
        } catch (e) { }
    }
    return attacker.onSlot
}

/**
 * 夜襲攻撃かを返す
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @return {Boolean} 夜襲攻撃か
 */
function isNightCvAttack(attacker, attackerHp) {
    var items = getItems(attacker)
    return (items.map(function (item) {
        return item.slotitemId
    }).some(function (itemid) {
        // 夜間作戦航空要員 or 夜間作戦航空要員＋熟練甲板員
        return itemid === 258 || itemid === 259
        // Saratoga Mk.II & 赤城改二戊
    }) || attacker.shipId === 545 || attacker.shipId === 599) && items.map(function (item) {
        return item.type3
    }).indexOf(45) >= 0 // 夜間戦闘機
        // 中破未満または装甲空母
        && (!attackerHp.isHalfDamage() || attacker.stype === 18)
}

/**
 * 弾薬量補正を返す
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 攻撃艦
 * @return {Number} 倍率
 */
var getAmmoBonus = function (ship) {
    return ship instanceof ShipDto ? Math.min(Math.floor(ship.bull / ship.bullMax * 100) / 50, 1) : 1.0
}

/**
 * 特効乗算補正を返す
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @return {Number} 倍率
 */
var getMultiplySlayerBonus = function (attacker, defender) {
    var items = getItems(attacker)
    var getItemNum = function (id) {
        return items.map(function (item) {
            return item.slotitemId
        }).filter(function (itemid) {
            return Array.isArray(id) ? id.indexOf(itemid) >= 0 : id === itemid
        }).length
    }

    switch (defender.shipId) {
        case 1637:
        case 1638:
        case 1639:
        case 1640: // PT小鬼群
            break
        case 1653:
        case 1654:
        case 1655: // 集積地棲姫
        case 1656:
        case 1657:
        case 1658: // 集積地棲姫-壊
            var daihatsu = getItemNum(68)
            var tokuDaihatsu = getItemNum(193)
            var rikuDaihatsu = getItemNum(166)
            var shikonDaihatsu = getItemNum(230)
            var daihatsuGroup = items.filter(function (item) { return item.type2 === 24 }).length
            var daihatsuGroupLv = daihatsuGroup > 0 ? items.filter(function (item) { return item.type2 === 24 }).map(function (item) { return item.level }).reduce(function (p, c) { return p + c }, 0) / daihatsuGroup : 0
            var kamisha = getItemNum(167)
            var kamishaLv = kamisha > 0 ? items.filter(function (item) { return item.slotitemId === 167 }).map(function (item) { return item.level }).reduce(function (p, c) { return p + c }, 0) / kamisha : 0
            var wg42 = getItemNum(126)

            var daihatsuGroupBonus = daihatsuGroupLv / 50 + 1
            var kamishaBonus = kamishaLv / 30 + 1
            var wg42Bonus = (wg42 >= 2 ? 1.3 : 1) * (wg42 ? 1.25 : 1)
            daihatsuGroupBonus *= daihatsuGroup ? 1.7 : 1.0
            daihatsuGroupBonus *= tokuDaihatsu ? 1.2 : 1.0
            daihatsuGroupBonus *= (rikuDaihatsu >= 2 ? 1.6 : 1) * (rikuDaihatsu ? 1.3 : 1.0)
            // 戦車を持っていたら2回計算
            daihatsuGroupBonus *= rikuDaihatsu ? (daihatsuGroupLv / 50 + 1) : 1
            kamishaBonus *= (kamisha >= 2 ? 1.5 : 1) * (kamisha ? 1.7 : 1.0)
            return wg42Bonus * daihatsuGroupBonus * kamishaBonus
    }
    return 1.0
}

/**
 * 特効加算補正を返す
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @return {Number} 倍率
 */
var getAddSlayerBonus = function (attacker, defender) {
    return 0
}

/**
 * 北端上棲姫か
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 */
var isNorthernmostLandingPrincess = function (ship) {
    return [1725, 1726, 1727].some(function (id) { return id === ship.shipId })
}

/**
 * 陸上特効倍率を返します
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @return {{multi:Number, add: Number, b12:Number}} 倍率
 */
var getLandBonus = function (attacker, defender) {
    if (!isGround(defender)) return {multi: 1.0, add: 0, b12: 0}
    var items = getItems(attacker)
    var getItemNum = function (id) {
        return items.map(function (item) {
            return item.slotitemId
        }).filter(function (itemid) {
            return Array.isArray(id) ? id.indexOf(itemid) >= 0 : id === itemid
        }).length
    }
    var type3shell = items.filter(function (item) { return item.type2 === 18 }).length
    var daihatsu = getItemNum(68)
    var tokuDaihatsu = getItemNum(193)
    var rikuDaihatsu = getItemNum(166)
    var shikonDaihatsu = getItemNum(230)
    var daihatsuGroup = items.filter(function (item) { return item.type2 === 24 }).length
    var daihatsuGroupLv = daihatsuGroup > 0 ? items.filter(function (item) { return item.type2 === 24 }).map(function (item) { return item.level }).reduce(function (p, c) { return p + c }, 0) / daihatsuGroup : 0
    var kamisha = getItemNum(167)
    var kamishaLv = kamisha > 0 ? items.filter(function (item) { return item.slotitemId === 167 }).map(function (item) { return item.level }).reduce(function (p, c) { return p + c }, 0) / kamisha : 0
    var suijo = items.filter(function (item) { return item.type2 === 11 || item.type2 === 45 }).length
    var apShell = items.filter(function (item) { return item.type2 === 19 }).length
    var wg42 = getItemNum(126)
    var bomber = items.filter(function (item) { return item.type2 === 7 }).length

    var type3shellBonus = 1
    var apShellBonus = 1
    var wg42Bonus = 1
    var daihatsuGroupBonus = daihatsuGroupLv / 50 + 1
    var kamishaBonus = kamishaLv / 30 + 1
    var suijoBonus = 1
    var stypeBonus = 1
    var bomberBonus = 1
    var additionBonus = 0
    var b12 = 0 // 仮置き

    switch (defender.shipId) {
        case 1668:
        case 1669:
        case 1670:
        case 1671:
        case 1672: // 離島棲姫
            type3shellBonus = type3shell ? 1.75 : 1
            wg42Bonus = (wg42 >= 2 ? 1.5 : 1) * (wg42 ? 1.4 : 1)
            daihatsuGroupBonus *= daihatsuGroup ? 1.8 : 1.0
            daihatsuGroupBonus *= tokuDaihatsu ? 1.15 : 1.0 // ソースが無いため仮置き
            daihatsuGroupBonus *= (rikuDaihatsu >= 2 ? 1.4 : 1) * (rikuDaihatsu ? 1.2 : 1.0)
            if (shikonDaihatsu) {
                daihatsuGroupBonus *= 1.8 // ソースが無いため仮置き
                additionBonus += 25
            }
            kamishaBonus *= (kamisha >= 2 ? 1.35 : 1) * (kamisha ? 2.4 : 1.0) // ソースが無いため仮置き
            bomberBonus = bomber ? 1.4 : 1
            if (attacker.stype === 13 || attacker.stype === 14) {
                b12 += 30
            }
            break
        case 1665:
        case 1666:
        case 1667: // 砲台小鬼
            apShellBonus = apShell ? 1.85 : 1
            wg42Bonus = (wg42 >= 2 ? 1.7 : 1) * (wg42 ? 1.6 : 1)
            daihatsuGroupBonus *= daihatsuGroup ? 1.8 : 1.0
            daihatsuGroupBonus *= tokuDaihatsu ? 1.15 : 1.0
            daihatsuGroupBonus *= (rikuDaihatsu >= 2 ? 1.4 : 1) * (rikuDaihatsu ? 1.5 : 1.0)
            if (shikonDaihatsu) {
                daihatsuGroupBonus *= 1.8
                additionBonus += 25
            }
            kamishaBonus *= (kamisha >= 2 ? 1.35 : 1) * (kamisha ? 2.4 : 1.0)
            suijoBonus = suijo ? 1.5 : 1
            bomberBonus = bomber ? 1.5 : 1
            stypeBonus = (attacker.stype === 2 || attacker.stype === 3) ? 1.4 : 1.0
            if (attacker.stype === 13 || attacker.stype === 14) {
                b12 += 30
            }
            break
        case 1699:
        case 1700:
        case 1701: // 港湾夏姫
        case 1702:
        case 1703:
        case 1704: // 港湾夏姫-壊
            type3shellBonus = type3shell ? 1.8 : 1
            wg42Bonus = wg42 ? 1.4 : 1
            if (rikuDaihatsu) {
                daihatsuGroupBonus *= 3.7
            } else if (tokuDaihatsu) {
                // daihatsuGroupBonus *= 1
            } else if (daihatsu) {
                daihatsuGroupBonus *= 1.8
            }
            kamishaBonus *= kamisha ? 2.8 : 1
            break
        case 1725:
        case 1726:
        case 1727: // 北端上陸姫
            return {multi: 1.0, add: 0}
        default: // ソフトスキン
            type3shellBonus = type3shell ? 2.5 : 1.0
            wg42Bonus = (wg42 >= 2 ? 1.4 : 1) * (wg42 ? 1.3 : 1)
            daihatsuGroupBonus *= daihatsuGroup ? 1.4 : 1.0
            daihatsuGroupBonus *= tokuDaihatsu ? 1.15 : 1.0
            daihatsuGroupBonus *= (rikuDaihatsu >= 2 ? 1.3 : 1) * (rikuDaihatsu ? 1.5 : 1.0)
            if (shikonDaihatsu) {
                daihatsuGroupBonus *= 1.8
                additionBonus += 25
            }
            kamishaBonus *= (kamisha >= 2 ? 1.2 : 1) * (kamisha ? 1.5 : 1.0)
            suijoBonus = suijo ? 1.2 : 1.0
            if (attacker.stype === 13 || attacker.stype === 14) {
                b12 += 30
            }
            break
    }
    return {
        multi: type3shellBonus * apShellBonus * wg42Bonus * daihatsuGroupBonus * kamishaBonus * suijoBonus * stypeBonus * bomberBonus,
        add: additionBonus,
        b12: b12,
    }
}

/**
 * WG42加算特効を返します
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @return {Number} 特効
 */
var getWg42Bonus = function (attacker, defender) {
    if (!isGround(defender) || isNorthernmostLandingPrincess(defender)) return 0
    var items = getItems(attacker)
    var count = items.filter(function (item) { return item.slotitemId === 126 }).length
    switch (count) {
        case 1: return 75
        case 2: return 110
        case 3: return 140
        case 4: return 160
        default: return 0
    }
}

/**
 * 交戦形態補正を返します
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @return {Number} 倍率
 */
var getFormationMatchBonus = function (formation) {
    switch (Number(formation[2])) {
        case 1: return 1.0 // 同航戦
        case 2: return 0.8 // 反航戦
        case 3: return 1.2 // T字有利
        case 4: return 0.6 // T字不利
    }
    return 1.0
}

/**
 * キャップ後の値を返します
 * @param {Number} value 火力
 * @param {Number} capValue キャップ値
 * @return {Number} キャップ後火力
 */
var getAfterCapValue = function (value, capValue) {
    return capValue < value ? Math.sqrt(value - capValue) + capValue : value
}

/**
 * クリティカル補正を返します
 * @param {AttackDto} attack 攻撃
 * @return {Number} 倍率
 */
var getCriticalBonus = function (attack) {
    return isCritical(attack) ? 1.5 : 1.0
}

/**
 * 熟練度倍率を返します
 * (戦爆連合CIは中途半端対応)
 * @param {java.util.Date} date 戦闘日時
 * @param {AttackDto} attack 攻撃
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @return {[Number,Number]} 倍率
 */
var getSkilledBonus = function (date, attack, attacker, defender, attackerHp) {
    var SKILLED = [
        { INTERNAL: [0, 9], DEPENDENCE_BONUS: [0, 0] },       // なし [0.00-0.03]
        { INTERNAL: [10, 24], DEPENDENCE_BONUS: [1, 1] },     // |    [0.04-0.05]
        { INTERNAL: [25, 39], DEPENDENCE_BONUS: [2, 2] },     // ||   [0.07-0.08]
        { INTERNAL: [40, 54], DEPENDENCE_BONUS: [3, 3] },     // |||  [0.09-0.10]
        { INTERNAL: [55, 69], DEPENDENCE_BONUS: [4, 4] },     // \    [0.11-0.12]
        { INTERNAL: [70, 84], DEPENDENCE_BONUS: [5, 7] },     // \\   [0.13-0.16]
        { INTERNAL: [85, 99], DEPENDENCE_BONUS: [7, 7] },     // \\\  [0.16-0.16]
        { INTERNAL: [100, 120], DEPENDENCE_BONUS: [8, 10] }, // >>   [0.20-0.20]
    ]
    var isSkilledObject = function (item) {
        switch (item.type2) {
            case 7:  // 艦上爆撃機
            case 8:  // 艦上攻撃機
            case 11: // 水上爆撃機
            case 41: // 大型飛行艇
            case 57: // 噴式戦闘爆撃機
            case 58: // 噴式攻撃機
                return true
            default:
                return false
        }
    }
    var ADD_SKILLED_DATE = getJstDate(2017, 10, 18, 12, 0, 0)
    var result = [1.0, 1.0]
    // rounds === 0 先制対潜
    // 自軍攻撃 && クリティカル && 先制対潜ではない && (昼戦攻撃が空撃 || 夜戦攻撃が夜襲 || 夜戦攻撃艦がArk Royal(改)) && (攻撃艦が補給艦かつ防御艦が潜水艦)ではない
    if (attack.friendAttack && isCritical(attack)/* && attack.rounds !== 0*/
        && (!attack.kind.isNight() && getAttackTypeAtDay(attack, attacker, defender) === 1 || attack.kind.isNight() && (isNightCvAttack(attacker, attackerHp) || [393, 515].indexOf(attacker.shipId) >= 0))
        && !(attacker.stype === 22 && isSubMarine(defender))) {
        var items = Java.from(attacker.item2.toArray())
        // 戦爆連合CI(熟練度は2017/10/18以降から)
        if (!attack.kind.isNight() && Number(attack.attackType) === 7 && date.after(ADD_SKILLED_DATE)) {
            // ちゃんと区別出来ないが、slotitemIdでしか区別出来ないため
            // 隊長機編隊
            if (items[0] !== null && Java.from(attack.showItem).some(function (slotitemId) { return Number(slotitemId) === items[0].slotitemId })) {
                result[0] = result[1] += 0.15
            }
            // 一旦平均で取っておく(後で修正)
            var onSlot = getOnSlot(attacker, date)
            var sumAlv = items.filter(function (item, i) { return item !== null && isSkilledObject(item) && onSlot[i] > 0 }).map(function (item) { return item.alv }).reduce(function (p, c) { return p + c }, 0)
            var cnt = items.filter(function (item, i) { return item !== null && isSkilledObject(item) && onSlot[i] > 0 }).length
            result[0] += SKILLED[Math.floor(sumAlv / cnt)].DEPENDENCE_BONUS[0] / 100
            result[1] += SKILLED[Math.floor(sumAlv / cnt)].DEPENDENCE_BONUS[1] / 100
        } else if (attack.kind.isNight() || !attack.kind.isNight() && Number(attack.attackType) !== 7) {
            var onSlot = getOnSlot(attacker, date)
            // 添字が必要なため(ズレる)
            items.forEach(function (item, i) {
                if (item !== null && isSkilledObject(item) && onSlot[i] > 0) {
                    if (i === 0) {
                        result[0] += Math.floor(Math.sqrt(SKILLED[item.alv].INTERNAL[0]) + SKILLED[item.alv].DEPENDENCE_BONUS[0]) / 100
                        result[1] += Math.floor(Math.sqrt(SKILLED[item.alv].INTERNAL[1]) + SKILLED[item.alv].DEPENDENCE_BONUS[1]) / 100
                    } else {
                        result[0] += Math.floor(Math.sqrt(SKILLED[item.alv].INTERNAL[0]) + SKILLED[item.alv].DEPENDENCE_BONUS[0]) / 200
                        result[1] += Math.floor(Math.sqrt(SKILLED[item.alv].INTERNAL[1]) + SKILLED[item.alv].DEPENDENCE_BONUS[1]) / 200
                    }
                }
            })
        }
    }
    return result
}

/**
 * クリティカルか
 * @param {AttackDto} attack 攻撃
 * @return {Boolean} クリティカルか
 */
var isCritical = function (attack) {
    return Number(attack.critical) === 2
}

/**
 * 特殊砲補正を取得します
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 * @return {Boolean} 特殊砲補正
 */
var getOriginalGunPowerBonus = function (ship) {
    var bonus = 0
    var ids = getItems(ship).map(function (item) { return item.slotitemId })
    // 軽巡軽量砲補正
    switch (ship.stype) {
        case 3:  // 軽巡
        case 4:  // 雷巡
        case 21: // 練巡
            bonus += Math.sqrt(ids.filter(function (id) { return id === 65 || id === 119 || id === 139 }).length) * 2 + Math.sqrt(ids.filter(function (id) { return id === 4 || id === 11 }).length)
    }
    // 伊重巡フィット砲補正
    switch (ship.shipId) {
        case 448: // Zara
        case 358: // Zara改
        case 496: // Zara due
        case 449: // Pola
        case 361: // Pola改
            bonus += Math.sqrt(ids.filter(function (id) { return id === 162 }).length)
    }
    return bonus
}

/**
 * 装甲補正を返します
 * @param {logbook.dto.MapCellDto} mapCell マップ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @return {Number} 装甲補正
 */
var getArmorBonus = function (mapCell, attacker, defender) {
    var mediumBulge = getItems(defender).filter(function (item) { return item.type2 === 27 }).map(function (item) { return 0.2 * item.level }).reduce(function (p, c) { return p + c }, 0)
    var largeBulge = getItems(defender).filter(function (item) { return item.type2 === 28 }).map(function (item) { return 0.2 * item.level }).reduce(function (p, c) { return p + c }, 0)
    var depthCharge = isSubMarine(defender) ? getItems(attacker).map(function (item) {
        switch (item.slotitemId) {
            case 226: return Math.sqrt(2) + (attacker.stype === 1 ? 1 : 0)
            case 227: return Math.sqrt(5) + (attacker.stype === 1 ? 1 : 0)
            default: return 0
        }
    }).reduce(function (p, c) { return p + c }, 0) : 0
    var northernSeaBulge = mapCell.map[0] === 3 && getItems(defender).some(function (item) { return item.slotitemId === 268 }) ? 3 : 0
    return mediumBulge + largeBulge - depthCharge + northernSeaBulge
}

/**
 * 陣形
 */
var FORMATION = {
    /** 単縦陣 */
    LINE_AHEAD: 1,
    /** 複縦陣 */
    DOUBLE_LINE: 2,
    /** 輪形陣 */
    DIAMOND: 3,
    /** 梯形陣 */
    ECHELON: 4,
    /** 単横陣 */
    LINE_ABREAST: 5,
    /** 警戒陣 */
    VANGUARD: 6,
    /** 第一警戒航行序列 */
    CRUISING_FORMATION_1: 11,
    /** 第二警戒航行序列 */
    CRUISING_FORMATION_2: 12,
    /** 第三警戒航行序列 */
    CRUISING_FORMATION_3: 13,
    /** 第四警戒航行序列 */
    CRUISING_FORMATION_4: 14,
}

/**
 * 連合艦隊
 */
var COMBINED_FLEET = {
    /** なし */
    NONE: 0,
    /** 空母機動部隊 */
    CARRIER_TASK_FORCE: 1,
    /** 水上打撃部隊 */
    SURFACE_TASK_FORCE: 2,
    /** 輸送護衛部隊 */
    TRANSPORT_ESCORT: 3,
}

/**
 * 時刻を取得する(JST)
 * @param {Number} year 年
 * @param {Number} month 月
 * @param {Number} date 日
 * @param {Number} hourOfDay 時
 * @param {Number} minute 分
 * @param {Number} second 秒
 */
var getJstDate = function (year, month, date, hourOfDay, minute, second) {
    var c = Calendar.getInstance(TimeZone.getTimeZone("JST"))
    c.clear()
    c.set(year, month - 1, date, hourOfDay, minute, second)
    return c.getTime()
}

/**
 * 攻撃側/防御側情報を返す
 * @param {AttackDto} attack
 * @param {FleetDto} friends 自軍側
 * @param {FleetDto} enemies 敵軍側
 * @return {AtkDefDto} 攻撃艦/防御艦
 */
var getAtkDef = function (attack, friends, enemies) {
    var attacker = (attack.friendAttack ? friends : enemies)[attack.mainAttack ? "main" : "escort"].get(attack.attacker % Math.max(6, (attack.friendAttack ? friends : enemies).main.length))
    var defender = (!attack.friendAttack ? friends : enemies)[attack.mainDefense ? "main" : "escort"].get(attack.defender % Math.max(6, (!attack.friendAttack ? friends : enemies).main.length))
    return new AtkDefDto(attacker, defender)
}

/**
 * 攻撃側/防御側Hpを返す
 * @param {AttackDto} attack
 * @param {FleetHpDto} friendHp
 * @param {FleetHpDto} enemyHp
 * @return {AtkDefHpDto} 攻撃艦/防御艦Hp
 */
var getAtkDefHp = function (attack, friendHp, enemyHp) {
    var attackerHp = (attack.friendAttack ? friendHp : enemyHp)[attack.mainAttack ? "main" : "escort"][attack.attacker % Math.max(6, (attack.friendAttack ? friendHp : enemyHp).main.length)]
    var defenderHp = (!attack.friendAttack ? friendHp : enemyHp)[attack.mainDefense ? "main" : "escort"][attack.defender % Math.max(6, (!attack.friendAttack ? friendHp : enemyHp).main.length)]
    return new AtkDefHpDto(attackerHp, defenderHp)
}

/**
 * ダメージ処理及びダメコン処理を行う
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 * @param {ShipHpDto} shipHp 艦Hp
 * @param {Number} damage ダメージ
 * @param {Boolean} dmgCtrl ダメコン処理をするか(デフォルト=true)
 */
var processingShipHpDamage = function (ship, shipHp, damage, dmgCtrl) {
    shipHp.now -= Math.floor(damage)
    if (dmgCtrl === undefined || dmgCtrl) {
        damageControl(shipHp, ship)
    }
}

/**
 * HP1に置き換える対象の艦か
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 * @param {Boolean} isFlagship 旗艦か
 * @return {Boolean} 対象か
 */
var isHp1ReplacementShip = function (ship, isFlagship) {
    if (ship instanceof ShipDto) {
        return (!isFlagship && ship.cond < 20)
    }
    return false
}

/**
 * 連合艦隊の種別を返します
 * @param {logbook.dto.BattleExDto} battle 戦闘
 * @return {-1|0|1|2|3} 連合艦隊の種別
 */
function calcCombinedKind(battle) {
    var ADD_TRANSPORTATION_FORCE_DATE = getJstDate(2015, 11, 18, 12, 0, 0)
    // 連合艦隊ではない場合
    if (!battle.isCombined()) return 0
    // フェーズが存在しない場合
    if (battle.phaseList.isEmpty()) return -1
    // 最初のフェーズ
    var phase = battle.phaseList.get(0)
    // 夜戦スタートか
    if (phase.isNight()) return -1
    // 水上打撃部隊のAPIか
    if (phase.api.equals(DataType.COMBINED_BATTLE_WATER.apiName) || phase.api.equals(DataType.COMBINED_EACH_BATTLE_WATER.apiName)) return 2
    // 空母機動部隊or輸送護衛部隊のAPIか
    if (phase.api.equals(DataType.COMBINED_BATTLE.apiName) || phase.api.equals(DataType.COMBINED_EACH_BATTLE.apiName)) {
        // 第一艦隊or第二艦隊が存在しない場合
        if (battle.dock === null || battle.dockCombined === null) return -1
        // 第一艦隊取得
        var ships = battle.dock.ships
        // 日付取得
        var date = battle.battleDate
        // 空母数取得
        var cv = ships.stream().filter(function (ship) { return ship !== null }).mapToInt(function (ship) { return ship.stype }).filter(function (stype) { return stype === 7 || stype === 11 || stype === 18 }).count()
        // 空母数2以上だと空母機動部隊振り分け
        if (cv >= 2) return 1
        // 輸送護衛部隊追加日以降か
        if (ADD_TRANSPORTATION_FORCE_DATE.before(date)) return 3
    }
    // 不明
    return -1
}

//#endregion

//#endregion
