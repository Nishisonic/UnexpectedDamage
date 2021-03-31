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
var VERSION = 2.13
/** バージョン確認URL */
var UPDATE_CHECK_URL = "https://api.github.com/repos/Nishisonic/UnexpectedDamage/releases/latest"
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
 * @param {Number} numOfAttackShips 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか
 * @param {FleetDto} origins 攻撃側艦隊
 * @return {AntiSubmarinePower|DayBattlePower} 昼戦火力
 */
var getDayBattlePower = function (date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    if (isSubMarine(defender)) {
        // 対潜水艦
        return new AntiSubmarinePower(date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    } else {
        // 対水上艦
        return new DayBattlePower(date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    }
}

/**
 * 雷撃戦火力算出
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} numOfAttackShips 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @return {TorpedoPower} 雷撃火力
 */
var getTorpedoPower = function (date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp) {
    return new TorpedoPower(date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp)
}

/**
 * 夜戦火力算出
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} numOfAttackShips 攻撃側艦数(警戒陣用)
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
var getNightBattlePower = function (date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, touchPlane, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    if (isSubMarine(defender)) {
        // 対潜水艦
        return new AntiSubmarinePower(date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    } else {
        // 対水上艦
        return new NightBattlePower(date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, touchPlane, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    }
}

/**
 * レーダー射撃戦火力算出
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} numOfAttackShips 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation レーダー射撃戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか
 * @param {FleetDto} origins 攻撃側艦隊
 * @return {AntiSubmarinePower|NightBattlePower} 夜戦火力
 */
var getRadarShootingPower = function (date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    if (isSubMarine(defender)) {
        // 対潜水艦
        return new AntiSubmarinePower(date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins, true)
    } else {
        // 対水上艦
        return new NightBattlePower(date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, [-1, -1], attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
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

    if ([7, 11, 18].indexOf(attacker.stype) >= 0) {
        return 1
    }

    if (isSubMarine(defender)) {
        if ([6, 10, 16, 17].indexOf(attacker.stype) >= 0) {
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

    if ([7, 11, 18].indexOf(attacker.stype) >= 0) {
        if ([353, 432, 433].indexOf(attacker.shipId) >= 0) {
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
        if ([6, 10, 16, 17].indexOf(attacker.stype) >= 0) {
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
 * PT小鬼群かどうか
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 * @return {boolean} PT小鬼群か
 */
var isPT = function (ship) {
    return [1637, 1638, 1639, 1640].indexOf(ship.shipId) >= 0
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

/**
 * 指定した装備の所持している個数を返します
 * @param {[logbook.dto.ItemDto]} items 装備
 * @param {Number} id 装備ID
 * @param {Number} minLevel 最低改修値(default = 0)
 * @return {Number} 個数
 */
var getItemNum = function (items, id, minLevel) {
    return items.filter(function (item) {
        return item.slotitemId === id && item.level >= (minLevel | 0)
    }).length
}

//#region 対潜関連

/**
 * 対潜関連処理
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} numOfAttackShips 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {FleetDto} origins 攻撃側艦隊
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか
 * @param {Boolean} isRadarShooting レーダー射撃戦か(default=false)
 */
var AntiSubmarinePower = function (date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins, isRadarShooting) {
    this.date = date
    this.kind = kind
    this.friendCombinedKind = friendCombinedKind
    this.isEnemyCombined = isEnemyCombined
    this.numOfAttackShips = numOfAttackShips
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
    this.CAP_VALUE = 100
    if (getJstDate(2017, 11, 10, 17, 7, 0).before(this.date)) {
        this.CAP_VALUE = 150
    }
    if (getJstDate(2021, 3, 1, 12, 0, 0).before(this.date)) {
        this.CAP_VALUE = 170
    }
}

/**
 * 対潜火力(基本攻撃力)を返します
 * @return {Number} 対潜火力(基本攻撃力)
 */
AntiSubmarinePower.prototype.getBasicPower = function () {
    // レーダー射撃戦専用処理
    if (this.isRadarShooting) {
        return Math.sqrt(this.attacker.raisou) * 2
    }
    var taisenShip = this.attacker.taisen - this.attacker.slotParam.taisen - getEquipmentBonus(this.date, this.attacker).asw
    var taisenItem = this.items.map(function (item) {
        switch (item.type2) {
            case 7:  // 艦上爆撃機
            case 8:  // 艦上攻撃機
            case 11: // 水上爆撃機
            case 14: // ソナー
            case 15: // 爆雷
            case 25: // 回転翼機
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
            case 7: // 艦上爆撃機
                // 九九式艦爆, 九九式艦爆(江草隊), 彗星(江草隊), 九九式艦爆二二型, 九九式艦爆二二型(熟練)
                return [23, 99, 100, 391, 392].indexOf(item.slotitemId) >= 0 ? 0.2 * item.level : 0
            case 8: // 艦上攻撃機
                return 0.2 * item.level
            case 14: // ソナー
            case 15: // 爆雷
                return Math.sqrt(item.level)
            case 25: // 回転翼機
                return (item.param.taisen > 10 ? 0.3 : 0.2) * item.level
            default:
                return 0
        }
    }).reduce(function (prev, current) {
        return prev + current
    }, 0)
}

/**
 * 対潜艦種別定数を返します
 * @return {0|8|13} 対潜艦種別定数
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
    var MYSTERY_FIXED_DATE = getJstDate(2019, 8, 8, 12, 0, 0)
    var depthCharge = MYSTERY_FIXED_DATE.after(this.date) ? [226, 227, 228] : [226, 227]
    if (this.items.some(function (item) { return item.slotitemId === 44 || item.slotitemId === 45 })
        && this.items.some(function (item) { return depthCharge.indexOf(item.slotitemId) >= 0 })) {
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
AntiSubmarinePower.prototype.getPrecapPower = function () {
    return this.getBasicPower() * getEngagementBonus(this.formation) * this.getFormationBonus() * this.getConditionBonus() * this.getSynergyBonus()
}

/**
 * 対潜火力(キャップ後)を返します
 * @return {[Number,Number]} 対潜火力(キャップ後)
 */
AntiSubmarinePower.prototype.getPostcapPower = function () {
    var v = Math.floor(getPostcapValue(this.getPrecapPower(), this.CAP_VALUE)) * getCriticalBonus(this.attack)
    var s = this.shouldUseSkilled ? getSkilledBonus(this.date, this.attack, this.attacker, this.defender, this.attackerHp) : [1.0, 1.0]
    return [Math.floor(v * s[0]), Math.floor(v * s[1])]
}

/**
 * 対潜陣形補正を返します
 * @return {Number} 倍率
 */
AntiSubmarinePower.prototype.getFormationBonus = function () {
    var CHANGE_ECHELON_BONUS_DATE = getJstDate(2019, 2, 27, 12, 0, 0)
    switch (this.formation[this.attack.friendAttack ? 0 : 1]) {
        case FORMATION.LINE_AHEAD: return 0.6
        case FORMATION.DOUBLE_LINE: return 0.8
        case FORMATION.DIAMOND: return 1.2
        case FORMATION.ECHELON: return CHANGE_ECHELON_BONUS_DATE.before(this.date) ? 1.1 : 1.0
        case FORMATION.LINE_ABREAST: return 1.3
        case FORMATION.VANGUARD: return this.attack.attacker < Math.floor(this.numOfAttackShips / 2) ? 1.0 : 0.6
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
 * @param {Number} numOfAttackShips 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか
 * @param {FleetDto} origins 攻撃側艦隊
 */
var DayBattlePower = function (date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    this.date = date
    this.kind = kind
    this.friendCombinedKind = friendCombinedKind
    this.isEnemyCombined = isEnemyCombined
    this.numOfAttackShips = numOfAttackShips
    this.formation = formation
    this.attack = attack
    this.attacker = attacker
    this.defender = defender
    this.attackerHp = attackerHp
    this.items = getItems(attacker)
    this.shouldUseSkilled = shouldUseSkilled
    this.origins = origins
    this.CAP_VALUE = 150
    if (getJstDate(2017, 3, 17, 12, 0, 0).before(this.date)) {
        this.CAP_VALUE = 180
    }
    if (getJstDate(2021, 3, 1, 12, 0, 0).before(this.date)) {
        this.CAP_VALUE = 220
    }
}

/**
 * 昼砲撃火力(基本攻撃力)を返します
 * @return {Number} 昼砲撃火力(基本攻撃力)
 */
DayBattlePower.prototype.getBasicPower = function () {
    var landBonus = getLandBonus(this.attacker, this.defender, true)
    // 空撃または陸上型かつ艦上爆撃機,艦上攻撃機,陸上攻撃機,噴式戦闘爆撃機,噴式攻撃機所持時?
    if (getAttackTypeAtDay(this.attack, this.attacker, this.defender) === 1 || isGround(this.attacker) && this.items.some(function (item) { return [7, 8, 47, 57, 58].indexOf(item.type2) >= 0 })) {
        // 空撃
        var rai = this.attacker.slotParam.raig
        var baku = this.attacker.slotParam.baku
        if (isGround(this.defender)) {
            rai = 0
            if (getJstDate(2019, 3, 27, 12, 0, 0).before(this.date)) {
                baku = this.items.filter(function (item) {
                    // Ju87C改
                    // 試製南山
                    // F4U-1D
                    // FM-2
                    // Ju87C改二(KMX搭載機)
                    // Ju87C改二(KMX搭載機/熟練)
                    // 彗星一二型(六三四空/三号爆弾搭載機)
                    // TBM-3W+3S
                    return [64, 148, 233, 277, 305, 306, 319, 389].indexOf(item.slotitemId) >= 0
                }).reduce(function(p, v) {
                    return p + v.param.baku
                }, 0)
            }
        }
        return 25 + Math.floor(1.5 * (((5 + this.attacker.karyoku + this.getImprovementBonus() + this.getCombinedPowerBonus()) * landBonus.a13 + landBonus.b13) * landBonus.a13_2 + landBonus.b13_2 + Math.floor(Math.floor(baku * 1.3) + rai) + 15))
    } else {
        // 砲撃
        return ((this.attacker.karyoku + this.getImprovementBonus() + this.getCombinedPowerBonus() + 5 + landBonus.b12) * landBonus.a13 + landBonus.b13) * landBonus.a13_2 + landBonus.b13_2
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
                    return [44, 45, 346].indexOf(item.slotitemId) >= 0 ? 0.75 : 0
                case 14: return 0.75    // ソナー
                case 40: return 0.75    // 大型ソナー
                case 24: return 1       // 上陸用舟艇
                case 46: return 1       // 特二式内火艇
                case 18: return 1       // 三式弾
                case 37: return 1       // 対地装備
                case 7:                 // 艦上爆撃機
                    // 九九式艦爆, 九九式艦爆(江草隊), 彗星(江草隊), 九九式艦爆二二型, 九九式艦爆二二型(熟練)
                    return [23, 99, 100, 391, 392].indexOf(item.slotitemId) >= 0 ? 0.5 : 0
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
                    case 358: // 5inch 単装高角砲群
                        return 0.2 * item.level
                    case 12:  // 15.5cm三連装副砲
                    case 234: // 15.5cm三連装副砲改
                    case 247: // 15.2cm三連装砲
                        return 0.3 * item.level
                }
            }
        // 艦上攻撃機
        } else if (item.type2 === 8) {
            return 0.2 * item.level
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
DayBattlePower.prototype.getPrecapPower = function () {
    return this.getBasicPower() * getEngagementBonus(this.formation) * this.getFormationBonus() * this.getConditionBonus() + getOriginalGunPowerBonus(this.attacker)
}

/**
 * 昼砲撃火力(キャップ後)を返します
 * @param {Boolean} noCL2 クリティカル前の昼砲撃火力値を返すか(デフォルト=false)
 * @return {[Number,Number]} 昼砲撃火力(キャップ後)
 */
DayBattlePower.prototype.getPostcapPower = function (noCL2) {
    // サイレント修正(Twitterで確認した限りでは17/9/9が最古=>17夏イベ?)以降、集積地棲姫特効のキャップ位置が変化(a5→a6)
    // 17夏以降に登場したPT小鬼群の特効位置もa6に変化?(乗算と加算組み合わせているっぽいので詳細不明)
    // A = [([キャップ後攻撃力] * 乗算特効補正 + 加算特効補正) * 乗算特効補正2] * 弾着観測射撃 * 戦爆連合カットイン攻撃
    var value = Math.floor((Math.floor(getPostcapValue(this.getPrecapPower(), this.CAP_VALUE)) * getMultiplySlayerBonus(this.attacker, this.defender) + getAddSlayerBonus(this.attacker, this.defender)) * getMultiplySlayerBonus2(this.attacker, this.defender)) * this.getSpottingBonus() * this.getUnifiedBombingBonus()
    // 徹甲弾補正判定
    if (this.isAPshellBonusTarget()) {
        // A = [A * 徹甲弾補正]
        value = Math.floor(value * this.getAPshellBonus())
    }
    // クリティカル判定
    if (!noCL2 && isCritical(this.attack)) {
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
    switch (this.formation[this.attack.friendAttack ? 0 : 1]) {
        case FORMATION.LINE_AHEAD: return 1.0
        case FORMATION.DOUBLE_LINE: return 0.8
        case FORMATION.DIAMOND: return 0.7
        case FORMATION.ECHELON:
            return CHANGE_ECHELON_BONUS_DATE.before(this.date) &&
                // 味方(梯形)→敵(連合) もしくは 敵(梯形)→味方(連合) で0.6倍 
                !(this.isEnemyCombined ? this.friendCombinedKind === COMBINED_FLEET.NONE : this.friendCombinedKind !== COMBINED_FLEET.NONE) ? 0.75 : 0.6
        case FORMATION.LINE_ABREAST: return 0.6
        case FORMATION.VANGUARD: return this.attack.attacker < Math.floor(this.numOfAttackShips / 2) ? 0.5 : 1.0
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
    switch (Number(this.attack.attackType)) {
        case 0: return 1.0   // 通常攻撃
        case 1: return 1.0   // レーザー攻撃
        case 2: return 1.2   // 連撃
        case 3: return 1.1   // 主砲+副砲
        case 4: return 1.2   // 主砲+電探
        case 5: return 1.3   // 主砲+徹甲弾
        case 6: return 1.5   // 主砲+主砲
        //case 7: return 1.0 // 戦爆連合CI
        default: return getSpecialAttackBonus(this)
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
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {Number} numOfAttackShips 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 */
var TorpedoPower = function (date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp) {
    this.date = date
    this.kind = kind
    this.friendCombinedKind = friendCombinedKind
    this.isEnemyCombined = isEnemyCombined
    this.numOfAttackShips = numOfAttackShips
    this.formation = formation
    this.attack = attack
    this.attacker = attacker
    this.defender = defender
    this.attackerHp = attackerHp
    this.items = getItems(attacker)
    this.CAP_VALUE = 150
    if (getJstDate(2021, 3, 1, 12, 0, 0).before(this.date)) {
        this.CAP_VALUE = 180
    }
}

/**
 * 雷撃火力(基本攻撃力)を返します
 * @return {Number} 雷撃火力(基本攻撃力)
 */
TorpedoPower.prototype.getBasicPower = function () {
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
TorpedoPower.prototype.getPrecapPower = function () {
    return this.getBasicPower() * getEngagementBonus(this.formation) * this.getFormationBonus() * this.getConditionBonus()
}

/**
 * 雷撃火力(キャップ後)を返します
 * @return {[Number,Number]} 雷撃火力(キャップ後)
 */
TorpedoPower.prototype.getPostcapPower = function () {
    var result = [0, 0]
    var value = getPostcapValue(this.getPrecapPower(), this.CAP_VALUE)
    var critical = getCriticalBonus(this.attack)
    result[0] = result[1] = Math.floor((Math.floor(value) * getMultiplySlayerBonus(this.attacker, this.defender) + getAddSlayerBonus(this.attacker, this.defender)) * getMultiplySlayerBonus2(this.attacker, this.defender) * critical)
    return result
}

/**
 * 雷撃陣形補正を返します
 * @return {Number} 倍率
 */
TorpedoPower.prototype.getFormationBonus = function () {
    switch (this.formation[this.attack.friendAttack ? 0 : 1]) {
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
 * @param {Number} numOfAttackShips 攻撃側艦数(警戒陣用)
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {[Number,Number]} touchPlane 夜間触接
 * @param {AttackDto} attack 攻撃データ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか
 * @param {FleetDto} origins 攻撃側艦隊
 */
var NightBattlePower = function (date, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, touchPlane, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    this.date = date
    this.kind = kind
    this.friendCombinedKind = friendCombinedKind
    this.isEnemyCombined = isEnemyCombined
    this.numOfAttackShips = numOfAttackShips
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
    if (getJstDate(2021, 3, 1, 12, 0, 0).before(this.date)) {
        this.CAP_VALUE = 360
    }
}

/**
 * 夜戦火力(基本攻撃力)を返します
 * @return {Number} 夜戦火力(基本攻撃力)
 */
NightBattlePower.prototype.getBasicPower = function () {
    var useRaisou = !isGround(this.defender) || isNorthernmostLandingPrincess(this.defender) || this.items.length === 0
    // 夜襲
    if (isNightCvAttack(this.attacker, this.attackerHp)) {
        var karyoku = this.attacker.karyoku - this.attacker.slotParam.karyoku - getEquipmentBonus(this.date, this.attacker).fp
        var nightPlaneBonus = Java.from(this.attacker.item2.toArray()).map(function (item, i) {
            var slot = getOnSlot(this.attacker, this.date)[i]
            if (item !== null && slot > 0) {
                // 夜戦、夜攻
                if (item.type3 === 45 || item.type3 === 46) {
                    // 火力+雷装+爆装+3*機数+0.45*(火力+雷装+爆装+対潜)*sqrt(機数)+sqrt(★)
                    return item.param.karyoku + (useRaisou ? item.param.raisou : 0) + item.param.baku + 3 * slot + 0.45 * (item.param.karyoku + item.param.raisou + item.param.baku + item.param.taisen) * Math.sqrt(slot) + Math.sqrt(item.level)
                } else {
                    switch (item.slotitemId) {
                        case 154: // 零戦62型(爆戦/岩井隊)
                        case 242: // Swordfish
                        case 243: // Swordfish Mk.II(熟練)
                        case 244: // Swordfish Mk.III(熟練)
                        case 320: // 彗星一二型(三一号光電管爆弾搭載機)
                            // 火力+雷装+爆装+0.3*(火力+雷装+爆装+対潜)*sqrt(機数)+sqrt(★)
                            return item.param.karyoku + (useRaisou ? item.param.raisou : 0) + item.param.baku + 0.3 * (item.param.karyoku + item.param.raisou + item.param.baku + item.param.taisen) * Math.sqrt(slot) + Math.sqrt(item.level)
                    }
                }
            }
            return 0
        }, this).reduce(function (p, c) { return p + c }, 0)
        return karyoku + nightPlaneBonus + this.getNightTouchPlaneBonus()
    } else {
        var landBonus = getLandBonus(this.attacker, this.defender, false)
        var power = 0
        // Ark Royal、Ark Royal改
        if ([393, 515].indexOf(this.attacker.shipId) >= 0) {
            power = this.attacker.karyoku
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
        } else {
            power = this.attacker.karyoku + (useRaisou ? this.attacker.raisou : 0) + this.getImprovementBonus()
        }
        return ((power + this.getNightTouchPlaneBonus() + landBonus.b12) * landBonus.a13 + landBonus.b13) * landBonus.a13_2 + landBonus.b13_2
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
                case 37: return 1 // 対地装備
                case 32: return 1 // 潜水艦魚雷
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
                case 358: // 5inch 単装高角砲群
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
    switch (this.formation[this.attack.friendAttack ? 0 : 1]) {
        case FORMATION.VANGUARD: return this.attack.attacker < Math.floor(this.numOfAttackShips / 2) ? 0.5 : 1.0
        default: return 1.0
    }
}

/**
 * 夜戦火力(キャップ前)を返します
 * @return {Number} 夜戦火力(キャップ前)
 */
NightBattlePower.prototype.getPrecapPower = function () {
    return this.getBasicPower() * this.getFormationBonus() * this.getCutinBonus() * this.getConditionBonus() + this.getPrecapPostMultiplyPower()
}

/**
 * キャップ前・乗算後の補正値を返します
 * @return {Number} 夜戦火力(キャップ前)
 */
NightBattlePower.prototype.getPrecapPostMultiplyPower = function () {
    return getOriginalGunPowerBonus(this.attacker)
}

/**
 * 夜戦火力(キャップ後)を返します
 * @return {[Number,Number]} 夜戦火力(キャップ後)
 */
NightBattlePower.prototype.getPostcapPower = function () {
    // A = [([キャップ後攻撃力] * 乗算特効補正 + 加算特効補正) * 乗算特効補正2]
    var value = Math.floor((Math.floor(getPostcapValue(this.getPrecapPower(), this.CAP_VALUE)) * getMultiplySlayerBonus(this.attacker, this.defender) + getAddSlayerBonus(this.attacker, this.defender)) * getMultiplySlayerBonus2(this.attacker, this.defender))
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
    /**
     * 駆逐専用CI:12.7cm連装砲D型ボーナスを返します
     * @return {Number} 倍率
     */
    var modelDGunBonus = function (items) {
        var ids = items.map(function(item) { return item.slotitemId })
        var modelD2 = ids.filter(function (id) { return id === 267 }).length
        var modelD3 = ids.filter(function (id) { return id === 366 }).length
        return (([1, 1.25, 1.4])[modelD2 + modelD3] || 1.4) * (1 + modelD3 * 0.05)
    }(this.items)

    switch (Number(this.attack.attackType)) {
        case 1: return 1.2  // 連撃
        case 2: return 1.3  // カットイン(主砲/魚雷)
        case 3:
            if (Java.from(this.attack.showItem).filter(function (id) { return [213, 214, 383].indexOf(Number(id)) >= 0 }).length
                && Java.from(this.attack.showItem).filter(function (id) { return [210, 211, 384].indexOf(Number(id)) >= 0 }).length) {
                return 1.75  // カットイン(後魚/潜電)
            }
            if (Java.from(this.attack.showItem).filter(function (id) { return [213, 214, 383].indexOf(Number(id)) >= 0 }).length >= 2) {
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
            var kind3 = items.filter(function (item) { return [154,242,243,244,320].indexOf(item.id) >= 0 }).length
            if (kind1 === 2 && kind2 === 1) return 1.25
            if ((kind1 + kind2 + kind3) === 2) return 1.2
            if ((kind1 + kind2 + kind3) === 3) return 1.18
            return 1.0
        case 7:             // 駆逐カットイン(主砲/魚雷/電探)
            return 1.3 * modelDGunBonus
        case 8:             // 駆逐カットイン(魚雷/見張員/電探)
            return 1.2 * modelDGunBonus
        default: return getSpecialAttackBonus(this)
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
        return [258, 259].indexOf(itemid) >= 0
        // Saratoga Mk.II or 赤城改二戊 or 加賀改二戊
    }) || [545, 599, 610].indexOf(attacker.shipId) >= 0) && items.some(function (item) {
        // 夜間戦闘機 or 夜間攻撃機
        return [45, 46].indexOf(item.type3) >= 0
        // 中破未満または装甲空母
    }) && (!attackerHp.isHalfDamage() || attacker.stype === 18)
}

/**
 * 弾薬量補正を返す
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 攻撃艦
 * @param {FleetDto} origins 攻撃側艦隊
 * @param {logbook.dto.MapCellDto} mapCell マップ
 * @return {Number} 倍率
 */
var getAmmoBonus = function (ship, origins, mapCell) {
    if (ship instanceof ShipDto) {
        var bull = ship.bull
        // 洋上補給処理
        if (mapCell.isBoss()) {
            var replenishment = Object.keys(origins).map(function(pos) {
                return origins[pos]
            }).filter(function(ships) {
                return ships
            }).map(function(ships) {
                return Java.from(ships.toArray()).filter(function(ship) {
                    return ship instanceof ShipDto
                }).map(function(ship) {
                    return getItems(ship)
                }).map(function(items) {
                    return items.filter(function(item) {
                        return item.slotitemId === 146
                    }).length
                }).reduce(function(p, v) {
                    return p + v
                }, 0)
            }).reduce(function(p, v) {
                return p + v
            }, 0)

            if (replenishment > 0) {
                if (origins["escort"]) {
                    // 連合艦隊
                    bull += Math.floor((Math.min(replenishment, 3) * 12.5 + 2.5) * ship.bullMax / 100)
                } else {
                    // 通常艦隊
                    bull += Math.floor((Math.min(replenishment, 3) * 11 + 14) * ship.bullMax / 100)
                }
            }
        }
        return Math.min(Math.floor(bull / ship.bullMax * 100) / 50, 1)
    }
    return 1.0
}

/**
 * 特効乗算補正を返す
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @return {Number} 倍率
 */
var getMultiplySlayerBonus = function (attacker, defender) {
    var items = getItems(attacker)
    /** [カテゴリ]三式弾 */
    var type3shell = items.filter(function (item) { return item.type2 === 18 }).length
    /** 大発動艇 */
    var daihatsu = getItemNum(items, 68)
    /** 特大発動艇 */
    var tokuDaihatsu = getItemNum(items, 193)
    /** 大発動艇(八九式中戦車&陸戦隊) */
    var rikuDaihatsu = getItemNum(items, 166)
    /** 特大発動艇+戦車第11連隊 */
    var shikonDaihatsu = getItemNum(items, 230)
    /** M4A1 DD */
    var m4a1dd = getItemNum(items, 355)
    /** 装甲艇(AB艇) */
    var armoredBoat = getItemNum(items, 408)
    /** 武装大発 */
    var armedDaihatsu = getItemNum(items, 409)
    /** [カテゴリ]上陸用舟艇 */
    var daihatsuGroup = items.filter(function (item) { return item.type2 === 24 }).length
    /** [カテゴリ]上陸用舟艇[改修] */
    var daihatsuGroupLv = daihatsuGroup > 0 ? items.filter(function (item) { return item.type2 === 24 }).map(function (item) { return item.level }).reduce(function (p, c) { return p + c }, 0) / daihatsuGroup : 0
    /** 特二式内火艇 */
    var kamisha = getItemNum(items, 167)
    /** 特定大発 */
    var specialDaihatsu = daihatsu + tokuDaihatsu + rikuDaihatsu + shikonDaihatsu + kamisha
    /** [カテゴリ]特型内火艇[改修] */
    var kamishaLv = kamisha > 0 ? items.filter(function (item) { return item.slotitemId === 167 }).map(function (item) { return item.level }).reduce(function (p, c) { return p + c }, 0) / kamisha : 0
    /** [カテゴリ]水上戦闘機・水上爆撃機 */
    var suijo = items.filter(function (item) { return [11, 45].indexOf(item.type2) >= 0 }).length
    /** [カテゴリ]徹甲弾 */
    var apShell = items.filter(function (item) { return item.type2 === 19 }).length
    /** WG42(Wurfgerät 42) */
    var wg42 = getItemNum(items, 126)
    /** 二式12cm迫撃砲改 */
    var type2Mortar = getItemNum(items, 346)
    /** 二式12cm迫撃砲改 集中配備 */
    var type2MortarEx = getItemNum(items, 347)
    /** [カテゴリ]迫撃砲 */
    var mortarGroup = type2Mortar + type2MortarEx
    /** 艦載型 四式20cm対地噴進砲 */
    var type4Rocket = getItemNum(items, 348)
    /** 四式20cm対地噴進砲 集中配備 */
    var type4RocketEx = getItemNum(items, 349)
    /** [カテゴリ]対地噴進砲 */
    var type4RocketGroup = type4Rocket + type4RocketEx
    /** [カテゴリ]艦上爆撃機 */
    var bomber = items.filter(function (item) { return item.type2 === 7 }).length
    /** Laté 298B */
    var late298B = getItemNum(items, 194)
    
    var ctype = (JSON.parse(Ship.get(attacker.shipId).json).api_ctype | 0)
    var overseasShip = [
        47, 63, 55, 48, 57, // ドイツ
        58, 68, 64, 92, 61, 80, // イタリア
        65, 69, 83, 87, 84, 91, 93, 95, 99, 102, // アメリカ
        67, 78, 82, 88, // イギリス
        79, 70, // フランス
        73, 81, // ロシア
        89, // スウェーデン
        98, // オランダ
        96, // オーストラリア
    ].indexOf(ctype) >= 0

    switch (defender.shipId) {
        case 1637:
        case 1638:
        case 1639:
        case 1640: // PT小鬼群
            return 0.35
        case 1653:
        case 1654:
        case 1655: // 集積地棲姫
        case 1656:
        case 1657:
        case 1658: // 集積地棲姫-壊
        case 1809:
        case 1810:
        case 1811: // 集積地棲姫 バカンスmode
        case 1812:
        case 1813:
        case 1814: // 集積地棲姫 バカンスmode-壊
        case 1933:
        case 1934:
        case 1935: // 集積地棲姫II 夏季上陸mode
        case 1936:
        case 1937:
        case 1938: // 集積地棲姫II 夏季上陸mode-壊
            var a = Math.pow(daihatsuGroupLv / 50 + 1, rikuDaihatsu ? 2 : 1) * (kamishaLv / 30 + 1)
            a *= (wg42 ? 1.25 : 1) * (wg42 >= 2 ? 1.3 : 1)
            a *= (type4RocketGroup ? 1.2 : 1) * (type4RocketGroup >= 2 ? 1.4 : 1)
            a *= (mortarGroup ? 1.15 : 1) * (mortarGroup >= 2 ? 1.2 : 1)
            a *= daihatsuGroup ? 1.7 : 1
            a *= tokuDaihatsu ? 1.2 : 1
            a *= (rikuDaihatsu ? 1.3 : 1) * (rikuDaihatsu >= 2 ? 1.6 : 1)
            a *= m4a1dd ? 1.2 : 1
            a *= (kamisha ? 1.7 : 1) * (kamisha >= 2 ? 1.5 : 1)
            a *= (armedDaihatsu ? 1.5 : 1) * (armedDaihatsu >= 2 ? 1.1 : 1)
            return a
        case 1696:
        case 1697:
        case 1698: // 戦艦夏姫
            var a = 1
            a *= suijo ? 1.1 : 1
            a *= apShell ? 1.2 : 1
            // 海外艦全指定(戦艦・空母のみ)
            if ([7, 8, 9, 10, 11, 12].indexOf(attacker.stype) >= 0) {
                a *= overseasShip ? 1.1 : 1
            }
            return a
        case 1705:
        case 1706:
        case 1707: // 重巡夏姫
            var a = 1
            a *= suijo ? 1.15 : 1
            a *= apShell ? 1.1 : 1
            return a
        case 1745:
        case 1746:
        case 1747: // 戦艦仏棲姫
        case 1748:
        case 1749:
        case 1750: // 戦艦仏棲姫-壊
            var a = 1
            a *= apShell ? 1.2 : 1
            a *= late298B ? 1.3 : 1
            a *= suijo ? 1.1 : 1
            a *= (bomber ? 1.1 : 1) * (bomber >= 2 ? 1.15 : 1)
            a *= attacker.shipInfo.flagship === "リシュリュー" ? 1.17 : 1
            return a
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
    switch (defender.shipId) {
        case 1637:
        case 1638:
        case 1639:
        case 1640: // PT小鬼群
            return 15
    }
    return 0
}

/**
 * 特効乗算補正2を返す
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @return {Number} 倍率
 */
var getMultiplySlayerBonus2 = function (attacker, defender) {
    var items = getItems(attacker)

    /** [カテゴリ]小口径主砲 */
    var smallGun = items.filter(function (item) { return item.type2 === 1 }).length
    /** [カテゴリ]副砲 */
    var subGun = items.filter(function (item) { return item.type2 === 4 }).length
    /** [カテゴリ]艦上爆撃機 */
    var bomber = items.filter(function (item) { return item.type2 === 7 }).length
    /** [カテゴリ]水上戦闘機・水上爆撃機 */
    var suijo = items.filter(function (item) { return [11, 45].indexOf(item.type2) >= 0 }).length
    /** [カテゴリ]機銃 */
    var aaGun = items.filter(function (item) { return item.type2 === 21 }).length
    /** [カテゴリ]水上艦要員 */
    var lookouts = items.filter(function (item) { return item.type2 === 39 }).length

    switch (defender.shipId) {
        case 1637:
        case 1638:
        case 1639:
        case 1640: // PT小鬼群
            var a = 1
            a *= smallGun ? 1.5 * 1.4 : 1
            a *= subGun ? 1.3 : 1
            a *= bomber ? 1.4 * 1.3 : 1
            a *= suijo ? 1.2 : 1
            a *= aaGun ? 1.2 * 1.2 : 1
            a *= lookouts ? 1.1 : 1
            return a
    }
    return 1.0
}

/**
 * 北端上棲姫か
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 */
var isNorthernmostLandingPrincess = function (ship) {
    return [1725, 1726, 1727].indexOf(ship.shipId) >= 0
}

/**
 * 泊地水鬼 バカンスmodeか
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 */
var isAnchorageWaterDemonVacationMode = function (ship) {
    return [1815, 1816, 1817, 1818, 1819, 1820].indexOf(ship.shipId) >= 0
}

/**
 * 陸上特効補正を返します
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {boolean} isDay 昼戦か
 * @return {{a13:Number, b12:Number, b13: Number}} 補正値
 */
var getLandBonus = function (attacker, defender, isDay) {
    if (!isGround(defender) && !isAnchorageWaterDemonVacationMode(defender) || isNorthernmostLandingPrincess(defender)) return {a13: 1, a13_2: 1, b12: 0, b13: 0, b13_2: 0}
    var items = getItems(attacker)
    /** [カテゴリ]三式弾 */
    var type3shell = items.filter(function (item) { return item.type2 === 18 }).length
    /** 大発動艇 */
    var daihatsu = getItemNum(items, 68)
    /** 特大発動艇 */
    var tokuDaihatsu = getItemNum(items, 193)
    /** 大発動艇(八九式中戦車&陸戦隊) */
    var rikuDaihatsu = getItemNum(items, 166)
    /** 特大発動艇+戦車第11連隊 */
    var shikonDaihatsu = getItemNum(items, 230)
    /** M4A1 DD */
    var m4a1dd = getItemNum(items, 355)
    /** 装甲艇(AB艇) */
    var armoredBoat = getItemNum(items, 408)
    /** 武装大発 */
    var armedDaihatsu = getItemNum(items, 409)
    /** [カテゴリ]上陸用舟艇 */
    var daihatsuGroup = items.filter(function (item) { return item.type2 === 24 }).length
    /** [カテゴリ]上陸用舟艇[改修] */
    var daihatsuGroupLv = daihatsuGroup > 0 ? items.filter(function (item) { return item.type2 === 24 }).map(function (item) { return item.level }).reduce(function (p, c) { return p + c }, 0) / daihatsuGroup : 0
    /** 特二式内火艇 */
    var kamisha = getItemNum(items, 167)
    /** 特定大発 */
    var specialDaihatsu = daihatsu + tokuDaihatsu + rikuDaihatsu + shikonDaihatsu + kamisha
    /** [カテゴリ]特型内火艇[改修] */
    var kamishaLv = kamisha > 0 ? items.filter(function (item) { return item.slotitemId === 167 }).map(function (item) { return item.level }).reduce(function (p, c) { return p + c }, 0) / kamisha : 0
    /** [カテゴリ]水上戦闘機・水上爆撃機 */
    var suijo = items.filter(function (item) { return [11, 45].indexOf(item.type2) >= 0 }).length
    /** [カテゴリ]徹甲弾 */
    var apShell = items.filter(function (item) { return item.type2 === 19 }).length
    /** WG42(Wurfgerät 42) */
    var wg42 = getItemNum(items, 126)
    /** 二式12cm迫撃砲改 */
    var type2Mortar = getItemNum(items, 346)
    /** 二式12cm迫撃砲改 集中配備 */
    var type2MortarEx = getItemNum(items, 347)
    /** [カテゴリ]迫撃砲 */
    var mortarGroup = type2Mortar + type2MortarEx
    /** 艦載型 四式20cm対地噴進砲 */
    var type4Rocket = getItemNum(items, 348)
    /** 四式20cm対地噴進砲 集中配備 */
    var type4RocketEx = getItemNum(items, 349)
    /** [カテゴリ]対地噴進砲 */
    var type4RocketGroup = type4Rocket + type4RocketEx
    /** [カテゴリ]艦上爆撃機 */
    var bomber = items.filter(function (item) { return item.type2 === 7 }).length
    /** Laté 298B */
    var late298B = getItemNum(items, 194)

    var a13 = (daihatsuGroupLv / 50 + 1) * (kamishaLv / 30 + 1)
    var b13_2 = ([0, 75, 110, 140, 160, 160])[wg42]
        + ([0, 30, 55, 75, 90, 90])[type2Mortar]
        + ([0, 60, 110, 150, 150, 150])[type2MortarEx]
        + ([0, 55, 115, 160, 190, 190])[type4Rocket]
        + ([0, 80, 170, 170, 170, 170])[type4RocketEx]

    switch (defender.shipId) {
        case 1665:
        case 1666:
        case 1667: // 砲台小鬼
            a13 *= apShell ? 1.85 : 1
            a13 *= (wg42 ? 1.6 : 1) * (wg42 >= 2 ? 1.7 : 1)
            a13 *= (type4RocketGroup ? 1.5 : 1) * (type4RocketGroup >= 2 ? 1.8 : 1)
            a13 *= (mortarGroup ? 1.3 : 1) * (mortarGroup >= 2 ? 1.5 : 1)
            a13 *= suijo ? 1.5 : 1
            a13 *= (bomber ? 1.5 : 1) * (bomber >= 2 ? 2.0 : 1)
            a13 *= daihatsuGroup ? 1.8 : 1
            a13 *= tokuDaihatsu ? 1.15 : 1
            a13 *= (rikuDaihatsu ? 1.5 : 1) * (rikuDaihatsu >= 2 ? 1.4 : 1)
            a13 *= shikonDaihatsu ? 1.8 : 1
            a13 *= m4a1dd ? 2.0 : 1
            a13 *= (kamisha ? 2.4 : 1) * (kamisha >= 2 ? 1.35 : 1)
            // 艦種補正(a12/13):駆逐艦、軽巡洋艦
            a13 *= [2, 3].indexOf(attacker.stype) >= 0 ? 1.4 : 1
            if (isDay) {
                a13 *= armedDaihatsu ? 1.3 : 1
            }
            break
        case 1668:
        case 1669:
        case 1670:
        case 1671:
        case 1672: // 離島棲姫
            a13 *= type3shell ? 1.75 : 1
            a13 *= (wg42 ? 1.4 : 1) * (wg42 >= 2 ? 1.5 : 1)
            a13 *= (type4RocketGroup ? 1.3 : 1) * (type4RocketGroup >= 2 ? 1.65 : 1)
            a13 *= (mortarGroup ? 1.2 : 1) * (mortarGroup >= 2 ? 1.4 : 1)
            a13 *= (bomber ? 1.4 : 1) * (bomber >= 2 ? 1.75 : 1)
            a13 *= daihatsuGroup ? 1.8 : 1
            a13 *= tokuDaihatsu ? 1.15 : 1
            a13 *= (rikuDaihatsu ? 1.2 : 1) * (rikuDaihatsu >= 2 ? 1.4 : 1)
            a13 *= shikonDaihatsu ? 1.8 : 1
            a13 *= m4a1dd ? 1.8 : 1
            a13 *= (kamisha ? 2.4 : 1) * (kamisha >= 2 ? 1.35 : 1)
            break
        case 1699:
        case 1700:
        case 1701: // 港湾夏姫
        case 1702:
        case 1703:
        case 1704: // 港湾夏姫-壊
            a13 *= type3shell ? 1.75 : 1
            a13 *= apShell ? 1.3 : 1
            a13 *= (wg42 ? 1.4 : 1) * (wg42 >= 2 ? 1.2 : 1)
            a13 *= (type4RocketGroup ? 1.25 : 1) * (type4RocketGroup >= 2 ? 1.4 : 1)
            a13 *= (mortarGroup ? 1.1 : 1) * (mortarGroup >= 2 ? 1.15 : 1)
            a13 *= suijo ? 1.3 : 1
            a13 *= (bomber ? 1.3 : 1) * (bomber >= 2 ? 1.2 : 1)
            a13 *= daihatsuGroup ? 1.7 : 1
            a13 *= tokuDaihatsu ? 1.2 : 1
            a13 *= (rikuDaihatsu ? 1.6 : 1) * (rikuDaihatsu >= 2 ? 1.5 : 1)
            a13 *= shikonDaihatsu ? 1.8 : 1
            a13 *= m4a1dd ? 2.0 : 1
            a13 *= kamisha ? 2.8 : 1
            break
        default: // ソフトスキン
            a13 *= type3shell ? 2.5 : 1
            a13 *= (wg42 ? 1.3 : 1) * (wg42 >= 2 ? 1.4 : 1)
            a13 *= (type4RocketGroup ? 1.25 : 1) * (type4RocketGroup >= 2 ? 1.5 : 1)
            a13 *= (mortarGroup ? 1.2 : 1) * (mortarGroup >= 2 ? 1.3 : 1)
            a13 *= suijo ? 1.2 : 1
            a13 *= daihatsuGroup ? 1.4 : 1
            a13 *= tokuDaihatsu ? 1.15 : 1
            a13 *= (rikuDaihatsu ? 1.5 : 1) * (rikuDaihatsu >= 2 ? 1.3 : 1)
            a13 *= shikonDaihatsu ? 1.8 : 1
            a13 *= m4a1dd ? 1.1 : 1
            a13 *= (kamisha ? 1.5 : 1) * (kamisha >= 2 ? 1.2 : 1)
            if (isDay) {
                a13 *= (armedDaihatsu ? 1.1 : 1) * (armedDaihatsu >= 2 ? 1.1 : 1)
                a13 *= armoredBoat ? 1.1 : 1
            }
            break
    }
    var a13_2 = m4a1dd ? 1.4 : 1
    if (specialDaihatsu) {
        // イコールは仕様
        if (armedDaihatsu === 1) {
            a13_2 *= 1.2
            b13_2 += 10
        }
        // 複数個ないから不明
        if (armoredBoat) {
            a13_2 *= 1.2
            b13_2 += 10
        }
    }

    return {
        a13: a13,
        a13_2: a13_2,
        // 潜水艦
        b12: [13, 14].indexOf(attacker.stype) >= 0 ? 30 : 0,
        b13: (shikonDaihatsu + m4a1dd) * 25,
        b13_2: b13_2
    }
}

/**
 * 交戦形態補正を返します
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @return {Number} 倍率
 */
var getEngagementBonus = function (formation) {
    switch (formation[2]) {
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
var getPostcapValue = function (value, capValue) {
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
        { INTERNAL: [100, 120], DEPENDENCE_BONUS: [8, 10] },  // >>   [0.20-0.20]
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
    // 自軍攻撃 & クリティカル & 先制対潜ではない & (昼戦攻撃が空撃 or 夜戦攻撃が夜襲 or 夜戦攻撃艦がArk Royal(改)) & (攻撃艦が(正規空母 or 装甲空母 or 補給艦) & 防御艦が潜水艦)ではない
    if (attack.friendAttack && isCritical(attack)/* && attack.rounds !== 0*/
        && (!attack.kind.isNight() && getAttackTypeAtDay(attack, attacker, defender) === 1 || attack.kind.isNight() && (isNightCvAttack(attacker, attackerHp) || [393, 515].indexOf(attacker.shipId) >= 0))
        && !([11, 18, 22].indexOf(attacker.stype) >= 0 && isSubMarine(defender))) {
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
    var singleGuns = [
        4, // 14cm単装砲
        11 // 15.2cm単装砲
    ]
    var twinGuns = [
        65,  // 15.2cm連装砲
        119, // 14cm連装砲
        139  // 15.2cm連装砲改
    ]
    if (date.after(getJstDate(2021, 3, 30, 12, 0, 0))) {
        twinGuns = twinGuns.concat([
            303, // Bofors 15.2cm連装砲 Model 1930
            310, // 14cm連装砲改
            359, // 6inch 連装速射砲 Mk.XXI
            360, // Bofors 15cm連装速射砲 Mk.9 Model 1938
            361, // Bofors 15cm連装速射砲 Mk.9改+単装速射砲 Mk.10改 Model 1938
            407  // 15.2cm連装砲改二
        ])
    }
    // 軽巡軽量砲補正
    switch (ship.stype) {
        case 3:  // 軽巡
        case 4:  // 雷巡
        case 21: // 練巡
            bonus += Math.sqrt(ids.filter(function (id) { return twinGuns.indexOf(id) >= 0 }).length) * 2 + Math.sqrt(ids.filter(function (id) { return singleGuns.indexOf(id) >= 0 }).length)
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
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.MapCellDto} mapCell マップ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @return {Number} 装甲補正
 */
var getArmorBonus = function (date, mapCell, attacker, defender) {
    // 装甲1に強制変換
    var MYSTERY_FIXED_DATE = getJstDate(2019, 8, 8, 12, 0, 0)
    if (isSubMarine(defender) && MYSTERY_FIXED_DATE.after(date)) {
        // 九六式艦戦改
        var has96FighterKai = getItems(attacker).some(function (item) { return item.slotitemId === 228 })
        if (has96FighterKai) {
            return Number.NEGATIVE_INFINITY
        }
    }

    var mediumBulge = getItems(defender).filter(function (item) { return item.type2 === 27 }).map(function (item) { return 0.2 * item.level }).reduce(function (p, c) { return p + c }, 0)
    var largeBulge = getItems(defender).filter(function (item) { return item.type2 === 28 }).map(function (item) { return 0.3 * item.level }).reduce(function (p, c) { return p + c }, 0)
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
 * 特殊攻撃倍率を返します
 * @param {DayBattlePower|NightBattlePower} that データ
 * @return {Number} 倍率
 */
var getSpecialAttackBonus = function(that) {
    var ADD_ITEM_BONUS_DATE = getJstDate(2018, 12, 7, 12, 0, 0)
    var UPDATE_SPECIAL_ATTACK_BONUS_DATE = getJstDate(2019, 2, 27, 12, 0, 0)
    var ships = that.origins[that.attack.mainAttack ? "main" : "escort"]
    var attackNum = that.attack.attackNum
    var engagement = that.formation[2]

    switch (Number(that.attack.attackType)) {
        case 100: // Nelson Touch
            return 2.0 * (engagement === 4 ? 1.25 : 1.0)
        case 101: // 一斉射かッ…胸が熱いな！
            var base = attackNum < 2 ? 1.4 : 1.2
            var secondShipBonus = function(date, secondShipId) {
                if (attackNum < 2) {
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
            }(that.date, ships[1].shipId)
            var itemBonus = function(date, items) {
                if (ADD_ITEM_BONUS_DATE.after(date)) return 1
                var surfaceRadarBonus = hasSurfaceRadar(items) ? 1.15 : 1
                var apShellBonus = hasAPShell(items) ? 1.35 : 1
                return surfaceRadarBonus * apShellBonus
            }(that.date, attackNum < 2 ? that.items : getItems(ships[1]))
            return base * secondShipBonus * itemBonus
        case 102: // 長門、いい？ いくわよ！ 主砲一斉射ッ！
            var base = attackNum < 2 ? 1.4 : 1.2
            var secondShipBonus = function(secondShipId) {
                if (attackNum < 2) {
                    switch (secondShipId) {
                        case 275:            // 長門改
                        case 541: return 1.2 // 長門改二
                    }
                } else {
                    switch (secondShipId) {
                        case 275:            // 長門改
                        case 541: return 1.4 // 長門改二
                    }
                }
                return 1.0
            }(ships[1].shipId)
            var itemBonus = function(items) {
                var surfaceRadarBonus = hasSurfaceRadar(items) ? 1.15 : 1
                var apShellBonus = hasAPShell(items) ? 1.35 : 1
                return surfaceRadarBonus * apShellBonus
            }(attackNum < 2 ? that.items : getItems(ships[1]))
            return base * secondShipBonus * itemBonus
        case 103: // Colorado 特殊攻撃
            var base = attackNum === 0 ? 1.3 : 1.15
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
            var companionShipBonus = function(secondShipId, thirdShipId) {
                switch (attackNum) {
                    case 1:
                        return isBig7(secondShipId) ? 1.1 : 1
                    case 2:
                        return isBig7(thirdShipId) ? 1.15 * (isBig7(secondShipId) ? 1.1 : 1) : 1
                }
                return 1
            }(ships[1].shipId, ships[2].shipId)
            var itemBonus = function(items, secondShipId, thirdShipId) {
                var surfaceRadarBonus = function(items) {
                    return hasSurfaceRadar(items) ? 1.15 : 1
                }
                var apShellBonus = function(items) {
                    return hasAPShell(items) ? 1.35 : 1
                }
                switch (attackNum) {
                    case 0: return surfaceRadarBonus(items) * apShellBonus(items)
                    case 1:
                        var secondShipItems = getItems(ships[1])
                        return surfaceRadarBonus(secondShipItems) * apShellBonus(secondShipItems)
                    case 2:
                        var secondShipItems = getItems(ships[1])
                        var thirdShipItems = getItems(ships[2])
                        if (isBig7(thirdShipId)) {
                            if (isBig7(secondShipId) || surfaceRadarBonus(secondShipItems) * apShellBonus(secondShipItems) > 1) {
                                return surfaceRadarBonus(secondShipItems) * apShellBonus(secondShipItems)
                            }
                            return surfaceRadarBonus(thirdShipItems) * apShellBonus(thirdShipItems)
                        } else if (ships[1].item2.size() === 5) {
                            var item = ships[1].item2.get(4)
                            // 二番艦に5スロの艦かつ補強増設が空いている状態で、
                            var cond = ships[1].hasSlotEx() && !ships[1].slotExItem
                            // 5番スロットに徹甲弾もしくは水上電探を装備
                                && (item && (isSurfaceRadar(item) || isAPshell(item)))
                            // そして三番艦にビッグ7ではない艦を置き、何かしらの装備を載せる
                                && thirdShipItems.length > 0
                            if (cond) {
                                return surfaceRadarBonus(secondShipItems) * apShellBonus(secondShipItems) * (isAPshell(item) ? 1.35 : 1.15)
                            }
                        }
                }
                return 1
            }(that.items, ships[1].shipId, ships[2].shipId)
            return base * companionShipBonus * itemBonus
        case 104: // 僚艦夜戦突撃
            var engagementBonus = function() {
                switch (engagement) {
                    case 3: return 1.25
                    case 4: return 0.75
                }
                return 1.0
            }()
            return 1.9 * engagementBonus
        case 200: return 1.35 // 瑞雲立体攻撃
        case 201: return 1.3 // 海空立体攻撃
        default: return 1.0  // それ以外
    }
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

/**
 * 水上電探を所持しているかを返す
 * @param {[logbook.dto.ItemDto]} items 装備
 * @return {Boolean} 所持の有無
 */
function hasSurfaceRadar(items) {
    return items.some(function(item) { return isSurfaceRadar(item) })
}

/**
 * 水上電探か
 * @param {logbook.dto.ItemDto} item 装備
 * @return {Boolean} 水上電探か
 */
function isSurfaceRadar(item) {
    return [12, 13].indexOf(item.type2) >= 0 && item.param.saku >= 5
}

/**
 * 対空電探を所持しているかを返す
 * @param {[logbook.dto.ItemDto]} items 装備
 * @return {Boolean} 所持の有無
 */
function hasAirRadar(items) {
    return items.some(function(item) { return isAirRadar(item) })
}

/**
 * 対空電探か
 * @param {logbook.dto.ItemDto} item 装備
 * @return {Boolean} 対空電探か
 */
function isAirRadar(item) {
    return [12, 13].indexOf(item.type2) >= 0 && item.param.tyku >= 2
}

/**
 * 徹甲弾を所持しているかを返す
 * @param {[logbook.dto.ItemDto]} items 装備
 * @return {Boolean} 所持の有無
 */
function hasAPShell(items) {
    return items.some(function(item) { return isAPshell(item) })
}

/**
 * 徹甲弾か
 * @param {logbook.dto.ItemDto | null} item 装備
 * @return {Boolean} 徹甲弾か
 */
function isAPshell(item) {
    return item.type2 === 19
}

/**
 * 装備ボーナスの値を返す
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @return {{fp: number, asw: number}}
 */
function getEquipmentBonus(date, attacker) {
    var shipId = attacker.shipId
    var stype = attacker.stype
    var ctype = (JSON.parse(Ship.get(attacker.shipId).json).api_ctype | 0)
    var yomi = attacker.shipInfo.flagship
    var items = getItems(attacker)
    var bonus = { fp: 0, asw: 0 }
    function add(effect, num, max) {
        ["fp", "asw"].forEach(function(param) {
            bonus[param] += (effect[param] | 0) * Math.min(num | 0, max | 0 || Infinity)
        })
    }
    var itemNums = items.reduce(function(previous, item) {
        previous[item.slotitemId] = (previous[item.slotitemId] | 0) + 1
        return previous
    }, {})
    var num = 0
    var US_SHIPS = [65, 69, 83, 87, 84, 91, 93, 95, 99, 102, 105, 106, 107]
    var US_CV_SHIPS = [69, 83, 84, 105]
    var UK_SHIPS = [67, 78, 82, 88, 108]
    var UK_CV_SHIPS = [78]

    // 艦上偵察機
    if (items.some(function(item) { return item.type2 === 9 })) {
        var max = items.filter(function(item) {
            return item.type2 === 9
        }).reduce(function(previous, item){
            return previous > item.level ? previous : item.level
        }, 0)
        if ([11, 18, 7, 10].indexOf(stype) >= 0) {
            var fp = 0
            if (max >= 4) fp++
            if (max >= 10) fp++
            add({ fp: fp }, 1)
        }
    }
    // 水上偵察機
    if (items.some(function(item) { return item.type2 === 10 })) {
        if ([662, 663, 668].indexOf(shipId) >= 0) {
            add({ asw: 3 }, 1)
        }
    }
    // 水上爆撃機
    if (items.some(function(item) { return item.type2 === 11 })) {
        if ([662, 663, 668].indexOf(shipId) >= 0) {
            add({ asw: 1 }, 1)
        }
    }
    // 電探
    // if (items.some(function(item) { return [12, 13].indexOf(item.type2) >= 0 })) {}
    // オートジャイロ
    if (items.some(function(item) { return item.type2 === 25 })) {
        if (shipId === 662) {
            add({ asw: 4 }, 1)
        }
        if ([663, 668].indexOf(shipId) >= 0) {
            add({ asw: 3 }, 1)
        }
    }
    // 探照灯
    // if (items.some(function(item) { return item.type2 === 29 })) {}
    // 大型探照灯
    // if (items.some(function(item) { return item.type2 === 42 })) {}
    // 10cm連装高角砲
    // 10cm連装高角砲+高射装置
    // if (num = itemNums[3] + itemNums[122]) {}
    // 15.5cm三連装砲
    // if (num = itemNums[5]) {}
    // 61cm四連装(酸素)魚雷
    // if (num = itemNums[15]) {}
    // 流星
    // 流星改
    if (num = itemNums[18] + itemNums[52]) {
        if (date.after(getJstDate(2019, 5, 20, 12, 0, 0))) {
            if ([277, 278, 156].indexOf(shipId) >= 0) {
                add({ fp: 1 }, num)
            } else if ([594, 698, 646].indexOf(shipId) >= 0) {
                add({ fp: 1 }, num)
            } else if ([599, 610].indexOf(shipId) >= 0) {
                add({ fp: 2 }, num)
            }
        }
    }
    // 九六式艦戦
    if (num = itemNums[19]) {
        if (date.after(getJstDate(2020, 3, 27, 12, 0, 0))) {
            if (yomi === "ほうしょう") {
                add({ fp: 2, asw: 2 }, num)
            }
            if ([75, 76].indexOf(ctype) >= 0) {
                add({ fp: 2, asw: 3 }, num)
            }
        } else if (date.after(getJstDate(2019, 8, 8, 12, 0, 0))) {
            if (yomi === "ほうしょう") {
                add({ fp: 1, asw: 1 }, num)
            }
            if ([75, 76].indexOf(ctype) >= 0) {
                add({ fp: 1, asw: 2 }, num)
            }
        }
    }
    // 彗星
    // 彗星一二型甲
    // 彗星(六〇一空)
    // if (num = itemNums[24] + itemNums[57] + itemNums[111]) {}
    // 瑞雲
    // 試製晴嵐
    // 瑞雲(六三四空)
    // 瑞雲12型
    // 瑞雲12型(六三四空)
    // 瑞雲(六三一空)
    // 晴嵐(六三一空)
    // if (num = itemNums[26] + itemNums[62] + itemNums[79] + itemNums[80] + itemNums[81] + itemNums[207] + itemNums[208]) {}
    // 三式弾
    // if (num = itemNums[35]) {}
    // 25mm連装機銃
    // 25mm三連装機銃
    // 25mm単装機銃
    // 25mm三連装機銃 集中配備
    // if (num = itemNums[39] + itemNums[40] + itemNums[49] + itemNums[131]) {}
    // 21号対空電探
    // 21号対空電探改二
    // if (num = itemNums[30] + itemNums[410]) {}
    // 九四式爆雷投射機
    // 三式爆雷投射機
    // 三式爆雷投射機 集中配備
    // 試製15cm9連装対潜噴進砲
    if (num = itemNums[44] + itemNums[45] + itemNums[287] + itemNums[288]) {
        if (date.after(getJstDate(2021, 3, 1, 12, 0, 0))) {
            if (ctype === 56) {
                add({ asw: 3 }, num)
            }
        }
    }
    // 九三式水中聴音機
    // 三式水中探信儀
    // 四式水中聴音機
    // 零式水中聴音機
    if (num = itemNums[44] + itemNums[45] + itemNums[149] + itemNums[132]) {
        if (date.after(getJstDate(2021, 3, 1, 12, 0, 0))) {
            if (ctype === 56) {
                add({ asw: 2 }, num, 1)
            }
        }
    }
    // 三式水中探信儀
    if (num = itemNums[47]) {
        if (date.after(getJstDate(2019, 1, 22, 12, 0, 0))) {
            if (["あさしも", "はるかぜ", "かみかぜ", "やまかぜ", "まいかぜ", "しぐれ"].indexOf(yomi) >= 0) {
                add({ asw: 3 }, num)
            } else if (["きしなみ", "いそかぜ", "はまかぜ", "うしお", "いかづち", "やまぐも"].indexOf(yomi) >= 0) {
                add({ asw: 2 }, num)
            }
        }
    }
    // 20.3cm(3号)連装砲
    // if (num = itemNums[50]) {}
    // 61cm五連装(酸素)魚雷
    // if (num = itemNums[58]) {}
    // 零式水上観測機
    // if (num = itemNums[59]) {}
    // 二式艦上偵察機
    if (num = itemNums[61]) {
        var max = items.filter(function(item) {
            return item.slotitemId === 61
        }).reduce(function(previous, item){
            return previous > item.level ? previous : item.level
        }, 0)
        if (yomi === "そうりゅう") {
            add({ fp: 3 }, num, 1)
        } else if (yomi === "ひりゅう") {
            add({ fp: 2 }, num, 1)
        }
        if ([508, 509, 560].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num, 1)
        }
        if (max >= 8) {
            if (shipId === 197) {
                add({ fp: 1 }, num, 1)
            }
        }
    }
    // 12.7cm連装砲B型改二
    // if (num = itemNums[63]) {}
    // 8cm高角砲
    // 8cm高角砲改+増設機銃
    // if (num = itemNums[66] + itemNums[220]) {}
    // 53cm艦首(酸素)魚雷
    // if (num = itemNums[67]) {}
    // カ号観測機
    if (num = itemNums[69]) {
        if (date.after(getJstDate(2020, 8, 27, 12, 0, 0))) {
            // 必要分のみ
            if ([554, 646].indexOf(shipId) >= 0) {
                add({ fp: Number(shipId === 646), asw: 2 }, num)
            }
            if (shipId === 553) {
                add({ asw: 1 }, num)
            }
        }
    }
    // 12.7cm単装砲
    // if (num = itemNums[78]) {}
    // 瑞雲(六三四空)
    // 瑞雲12型(六三四空)
    // if (num = itemNums[79] + itemNums[81]) {}
    // 九七式艦攻(九三一空)
    if (num = itemNums[82]) {
        if (date.after(getJstDate(2018, 8, 30, 18, 0, 0))) {
            if (ctype === 76) {
                add({ asw: 1 }, num)
            }
        }
    }
    // 新型高温高圧缶
    // if (num = itemNums[87]) {}
    // 20.3cm(2号)連装砲
    // if (num = itemNums[90]) {}
    // 九七式艦攻(友永隊)
    if (num = itemNums[93]) {
        if (date.after(getJstDate(2019, 4, 30, 21, 0, 0))) {
            if (yomi === "そうりゅう") {
                add({ fp: 1 }, num, 1)
            } else if (yomi === "ひりゅう") {
                add({ fp: 3 }, num, 1)
            }
        }
    }
    // 天山一二型(友永隊)
    if (num = itemNums[94]) {
        if (date.after(getJstDate(2019, 4, 30, 21, 0, 0))) {
            if (shipId === 196) {
                add({ fp: 7 }, num, 1)
            } else if (shipId === 197) {
                add({ fp: 3 }, num, 1)
            }
        }
    }
    // 九九式艦爆(江草隊)
    if (num = itemNums[99]) {
        if (date.after(getJstDate(2019, 4, 30, 21, 0, 0))) {
            if (yomi === "そうりゅう") {
                add({ fp: 4 }, num, 1)
            } else if (yomi === "ひりゅう") {
                add({ fp: 1 }, num, 1)
            }
        }
    }
    // 彗星(江草隊)
    if (num = itemNums[100]) {
        if (date.after(getJstDate(2019, 4, 30, 21, 0, 0))) {
            if (shipId === 196) {
                add({ fp: 3 }, num)
            } else if (shipId === 197) {
                add({ fp: 6 }, num)
            }
        }
    }
    // 35.6cm連装砲(ダズル迷彩)
    // if (num = itemNums[104]) {}
    // 13号対空電探改
    // if (num = itemNums[106]) {}
    // Ar196改
    // if (num = itemNums[115]) {}
    // 紫雲
    // if (num = itemNums[118]) {}
    // 14cm連装砲
    // if (num = itemNums[119]) {}
    // 94式高射装置
    // if (num = itemNums[121]) {}
    // 10cm連装高角砲+高射装置
    // if (num = itemNums[122]) {}
    // 熟練見張員
    if (num = itemNums[129]) {
        if (date.after(getJstDate(2020, 3, 27, 12, 0, 0))) {
            if ([66, 28, 12, 1, 5, 10, 23, 18, 30, 38, 22, 54, 101].indexOf(ctype) >= 0) {
                add({ asw: 2 }, num)
            }
        }
    }
    // 15.2cm連装砲改
    // if (num = itemNums[139]) {}
    // 九七式艦攻(村田隊)
    if (num = itemNums[143]) {
        if (date.after(getJstDate(2019, 4, 30, 21, 0, 0))) {
            if (yomi === "あかぎ") {
                add({ fp: 3 }, num, 1)
            } else if (["かが", "しょうかく"].indexOf(yomi) >= 0) {
                add({ fp: 2 }, num, 1)
            } else if (["ずいかく", "りゅうじょう"].indexOf(yomi) >= 0) {
                add({ fp: 1 }, num, 1)
            }
        }
    }
    // 天山(村田隊)
    if (num = itemNums[144]) {
        if (date.after(getJstDate(2019, 4, 30, 21, 0, 0))) {
            if (yomi === "あかぎ") {
                add({ fp: 3 }, num, 1)
            } else if (yomi === "かが") {
                add({ fp: 2 }, num, 1)
            } else if (yomi === "しょうかく") {
                add({ fp: 2 }, num, 1)
                if ([461, 466].indexOf(shipId) >= 0) {
                    add({ fp: 2 }, num, 1)
                }
            } else if (yomi === "ずいかく") {
                add({ fp: 1 }, num, 1)
                if ([462, 467].indexOf(shipId) >= 0) {
                    add({ fp: 1 }, num, 1)
                }
            } else if (yomi === "りゅうじょう") {
                add({ fp: 1 }, num, 1)
            }
        }
    }
    // 120mm/50 連装砲
    // 120mm/50 連装砲 mod.1936
    // 120mm/50 連装砲改 A.mod.1937
    // if (num = itemNums[147] + itemNums[393] + itemNums[394]) {}
    // 四式水中聴音機
    if (num = itemNums[149]) {
        if (date.after(getJstDate(2020, 1, 14, 12, 0, 0))) {
            if ([488, 141, 160, 622, 623, 656].indexOf(shipId) >= 0) {
                add({ asw: 1 }, num, 1)
            } else if (shipId === 624) {
                add({ asw: 3 }, num, 1)
            } else if (shipId === 662) {
                add({ asw: 2 }, num, 1)
            }
            if (ctype === 54) {
                add({ asw: 1 }, num, 1)
            }
        }
    }
    // 二式水戦改
    // 二式水戦改(熟練)
    // if (num = itemNums[165] + itemNums[216]) {}
    // OS2U
    if (num = itemNums[171]) {
        if (date.after(getJstDate(2020, 5, 20, 12, 0, 0))) {
            if (US_CV_SHIPS.indexOf(ctype) >= 0) {
                if (getItemNum(items, 171, 10) > 0) {
                    add({ fp: 1 }, num, 1)
                }
            }
        }
    }
    // 53cm連装魚雷
    // if (num = itemNums[174]) {}
    // 試製61cm六連装(酸素)魚雷
    // if (num = itemNums[179]) {}
    // Re.2001 OR改
    if (num = itemNums[184]) {
        if (ctype === 68) {
            add({ fp: 1 }, num)
        }
    }
    // Re.2001 G改
    if (num = itemNums[188]) {
        if (ctype === 68) {
            add({ fp: 3 }, num)
        }
    }
    // Re.2005 改
    // if (num = itemNums[189]) {}
    // Laté 298B
    // if (num = itemNums[194]) {}
    // 艦本新設計 増設バルジ(大型艦)
    // if (num = itemNums[204]) {}
    // 強風改
    // if (num = itemNums[217]) {}
    // 8cm高角砲改+増設機銃
    // if (num = itemNums[220]) {}
    // 九六式艦戦改
    if (num = itemNums[228]) {
        if (date.after(getJstDate(2020, 3, 27, 12, 0, 0))) {
            if (yomi === "ほうしょう") {
                add({ fp: 3, asw: 4 }, num)
            }
            if ([75, 76].indexOf(ctype) >= 0) {
                add({ fp: 2, asw: 5 }, num)
            }
            if (stype === 7) {
                add({ asw: 2 }, num)
            }
        } else if (date.after(getJstDate(2019, 8, 8, 12, 0, 0))) {
            if (yomi === "ほうしょう") {
                add({ fp: 1 }, num)
            }
            if ([75, 76].indexOf(ctype) >= 0) {
                add({ fp: 1, asw: 2 }, num)
            }
            if (stype === 7) {
                add({ asw: 2 }, num)
            }
        }
    }
    // 12.7cm単装高角砲(後期型)
    if (num = itemNums[229]) {
        if (date.after(getJstDate(2017, 6, 23, 12, 0, 0))) {
            if (shipId === 656) {
                add({ asw: 2 }, num)
            }
        }
    }
    // 15.5cm三連装砲改
    // if (num = itemNums[235]) {}
    // 瑞雲(六三四空/熟練)
    // 瑞雲改二(六三四空)
    // 瑞雲改二(六三四空/熟練)
    // if (num = itemNums[237] + itemNums[322] + itemNums[323]) {}
    // 瑞雲(六三四空/熟練)
    // if (num = itemNums[237]) {}
    // 零式水上偵察機11型乙
    // 零式水上偵察機11型乙(熟練)
    // if (num = itemNums[238] + itemNums[239]) {}
    // Swordfish
    if (num = itemNums[242]) {
        if (date.after(getJstDate(2021, 2, 5, 12, 0, 0))) {
            if (ctype === 78) {
                add({ fp: 2 }, num)
            }
            if (yomi === "ほうしょう") {
                add({ asw: 1 }, num)
            }
        }
    }
    // Swordfish Mk.II(熟練)
    if (num = itemNums[243]) {
        if (date.after(getJstDate(2021, 2, 5, 12, 0, 0))) {
            if (ctype === 78) {
                add({ fp: 3 }, num)
            }
            if (yomi === "ほうしょう") {
                add({ asw: 2 }, num)
            }
        }
    }
    // Swordfish Mk.III(熟練)
    if (num = itemNums[244]) {
        if (date.after(getJstDate(2021, 2, 5, 12, 0, 0))) {
            if (ctype === 78) {
                add({ fp: 4 }, num)
            }
            if (yomi === "ほうしょう") {
                add({ asw: 3 }, num)
            }
        }
    }
    // 12.7cm連装砲C型改二
    // if (num = itemNums[266]) {}
    // 12.7cm連装砲D型改二
    // 12.7cm連装砲D型改三
    // if (num = itemNums[267] + itemNums[366]) {}
    // 北方迷彩(+北方装備)
    // if (num = itemNums[268]) {}
    // SK レーダー
    // if (num = itemNums[278]) {}
    // SK+SG レーダー
    if (num = itemNums[279]) {
        if (date.after(getJstDate(2020, 5, 20, 12, 0, 0))) {
            if (US_CV_SHIPS.indexOf(ctype) >= 0) {
                add({ fp: 2 }, num, 1)
            } else if (UK_CV_SHIPS.indexOf(ctype) >= 0) {
                add({ fp: 1 }, num, 1)
            } else if (ctype === 96) {
                add({ fp: 1 }, num, 1)
            }
        }
    }
    // 130mm B-13連装砲
    // if (num = itemNums[282]) {}
    // 533mm 三連装魚雷
    // if (num = itemNums[283]) {}
    // 61cm三連装(酸素)魚雷後期型
    // if (num = itemNums[285]) {}
    // 61cm四連装(酸素)魚雷後期型
    // if (num = itemNums[286]) {}
    // 三式爆雷投射機 集中配備
    if (num = itemNums[287]) {
        if (date.after(getJstDate(2020, 1, 14, 12, 0, 0))) {
            if ([488, 141, 160, 624, 656].indexOf(shipId) >= 0) {
                add({ asw: 1 }, num)
            } else if (shipId === 662) {
                add({ asw: 3 }, num)
            }
        }
    }
    // 試製15cm9連装対潜噴進砲
    if (num = itemNums[288]) {
        if (date.after(getJstDate(2020, 1, 14, 12, 0, 0))) {
            if ([488, 141, 160, 656].indexOf(shipId) >= 0) {
                add({ asw: 2 }, num)
            } else if (shipId === 624) {
                add({ asw: 3 }, num)
            } else if (shipId === 662) {
                add({ asw: 4 }, num)
            }
        }
    }
    // 35.6cm三連装砲改(ダズル迷彩仕様)
    // if (num = itemNums[289]) {}
    // 41cm三連装砲改二
    // if (num = itemNums[290]) {}
    // 彗星二二型(六三四空)
    // if (num = itemNums[291]) {}
    // 彗星二二型(六三四空/熟練)
    // if (num = itemNums[292]) {}
    // 12cm単装砲改二
    if (num = itemNums[293]) {
        if ([74, 77].indexOf(ctype) >= 0) {
            if (hasSurfaceRadar(items)) {
                add({ asw: 1 }, num, 1)
            }
        }
    }
    // 12.7cm連装砲A型改二
    // if (num = itemNums[294]) {}
    // 12.7cm連装砲A型改三(戦時改修)+高射装置
    // if (num = itemNums[295]) {}
    // 12.7cm連装砲B型改四(戦時改修)+高射装置
    // if (num = itemNums[296]) {}
    // 12.7cm連装砲A型
    // if (num = itemNums[297]) {}
    // 16inch Mk.I三連装砲
    // 16inch Mk.I三連装砲+AFCT改
    // 16inch Mk.I三連装砲改+FCR type284
    // if (num = itemNums[298] + itemNums[299] + itemNums[300]) {}
    // 20連装7inch UP Rocket Launchers
    // if (num = itemNums[301]) {}
    // 九七式艦攻(九三一空/熟練)
    if (num = itemNums[302]) {
        if (date.after(getJstDate(2018, 8, 30, 18, 0, 0))) {
            if (ctype === 76) {
                add({ asw: 1 }, num)
            }
        }
    }
    // Bofors 15.2cm連装砲 Model 1930
    // if (num = itemNums[303]) {}
    // S9 Osprey
    if (num = itemNums[304]) {
        if ([16, 4, 20, 41].indexOf(ctype) >= 0) {
            add({ asw: 1 }, num)
        } else if (ctype === 89) {
            add({ asw: 2 }, num)
        }
    }
    // Ju87C改二(KMX搭載機)
    // Ju87C改二(KMX搭載機／熟練)
    if (num = itemNums[305] + itemNums[306]) {
        if (date.after(getJstDate(2018, 8, 30, 18, 0, 0))) {
            if (ctype === 76) {
                add({ asw: 1 }, num)
                if (yomi === "しんよう") {
                    add({ asw: 2 }, num)
                }
            } else if (["グラーフ・ツェッペリン", "アクィラ"]) {
                add({ fp: 1 }, num)
            }
        }
    }
    // GFCS Mk.37
    if (num = itemNums[307]) {
        if (US_CV_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // 5inch単装砲 Mk.30改+GFCS Mk.37
    // if (num = itemNums[308]) {}
    // 14cm連装砲改
    if (num = itemNums[310]) {
        if (date.after(getJstDate(2020, 1, 14, 12, 0, 0))) {
            if ([622, 623, 624].indexOf(shipId) >= 0) {
                add({ asw: 1 }, num)
            }
        }
    }
    // 5inch単装砲 Mk.30改
    // if (num = itemNums[313]) {}
    // 533mm五連装魚雷(初期型)
    // if (num = itemNums[314]) {}
    // SG レーダー(初期型)
    // if (num = itemNums[315]) {}
    // Re.2001 CB改
    if (num = itemNums[316]) {
        if (ctype === 68) {
            add({ fp: 4 }, num)
        }
    }
    // 三式弾改
    // if (num = itemNums[317]) {}
    // 41cm連装砲改二
    // if (num = itemNums[318]) {}
    // 彗星一二型(六三四空/三号爆弾搭載機)
    // if (num = itemNums[319]) {}
    // 彗星一二型(三一号光電管爆弾搭載機)
    if (num = itemNums[320]) {
        if (shipId === 196) {
            add({ fp: 3 }, num)
        } else if (shipId === 197) {
            add({ fp: 3 }, num)
        } else if (shipId === 508) {
            add({ fp: 4 }, num)
        } else if (shipId === 509) {
            add({ fp: 4 }, num)
        }
    }
    // 瑞雲改二(六三四空)
    if (num = itemNums[322]) {
        if ([554, 553].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num)
        }
    }
    // 瑞雲改二(六三四空/熟練)
    if (num = itemNums[323]) {
        if ([554, 553].indexOf(shipId) >= 0) {
            add({ asw: 2 }, num)
        }
    }
    // オ号観測機改
    // オ号観測機改二
    if (num = itemNums[324] + itemNums[325]) {
        if (date.after(getJstDate(2020, 8, 27, 12, 0, 0))) {
            if ([554, 646].indexOf(shipId) >= 0) {
                add({ fp: (shipId === 646 ? 2 : 0), asw: 3 }, num)
            } else if (shipId === 553) {
                add({ asw: 2 }, num)
            }
        } else {
            if (shipId === 554) {
                add({ asw: 2 }, num)
            } else if (shipId === 553) {
                add({ asw: 1 }, num)
            }
        }
    }
    // S-51J
    if (num = itemNums[326]) {
        if (date.after(getJstDate(2020, 8, 27, 12, 0, 0))) {
            if (shipId === 646) {
                add({ fp: 3, asw: 5 }, num)
            } else if (shipId === 554) {
                add({ asw: 4 }, num)
            } else if (shipId === 553) {
                add({ asw: 3 }, num)
            }
        } else {
            if (shipId === 554) {
                add({ asw: 3 }, num)
            } else if (shipId === 553) {
                add({ asw: 2 }, num)
            }
        }
    }
    // S-51J改
    if (num = itemNums[327]) {
        if (date.after(getJstDate(2020, 8, 27, 12, 0, 0))) {
            if (shipId === 646) {
                add({ fp: 5, asw: 6 }, num)
            } else if (shipId === 554) {
                add({ asw: 5 }, num)
            } else if (shipId === 553) {
                add({ asw: 4 }, num)
            }
        } else {
            if (shipId === 554) {
                add({ asw: 4 }, num)
            } else if (shipId === 553) {
                add({ asw: 3 }, num)
            }
        }
    }
    // 35.6cm連装砲改
    // if (num = itemNums[328]) {}
    // 35.6cm連装砲改二
    // if (num = itemNums[329]) {}
    // 16inch Mk.I連装砲
    // 16inch Mk.V連装砲
    // 16inch Mk.VIII連装砲改
    // if (num = itemNums[330] + itemNums[331] + itemNums[332]) {}
    // 烈風改(試製艦載型)
    // if (num = itemNums[335]) {}
    // 烈風改二
    if (num = itemNums[336]) {
        if ([277, 278].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([594, 599, 610, 646, 698].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // 烈風改二(一航戦/熟練)
    if (num = itemNums[337]) {
        if ([277, 278].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([594, 599, 610, 646, 698].indexOf(shipId) >= 0) {
            add({ fp: 2 }, num)
        }
    }
    // 烈風改二戊型
    if (num = itemNums[338]) {
        if ([277, 278].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([594, 646, 698].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([599, 610].indexOf(shipId) >= 0) {
            add({ fp: 4 }, num)
        }
    }
    // 烈風改二戊型(一航戦/熟練)
    if (num = itemNums[339]) {
        if ([277, 278].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([594, 646, 698].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([599, 610].indexOf(shipId) >= 0) {
            add({ fp: 6 }, num)
        }
    }
    // 152mm/55 三連装速射砲
    // if (num = itemNums[340]) {}
    // 152mm/55 三連装速射砲改
    // if (num = itemNums[341]) {}
    // 流星改(一航戦)
    if (num = itemNums[342]) {
        if ([277, 278, 461, 466, 462, 467].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([594, 646, 698].indexOf(shipId) >= 0) {
            add({ fp: 2 }, num)
        } else if ([599, 610].indexOf(shipId) >= 0) {
            add({ fp: 3 }, num)
        }
    }
    // 流星改(一航戦/熟練)
    if (num = itemNums[343]) {
        if ([277, 278].indexOf(shipId) >= 0) {
            add({ fp: 2 }, num)
        } else if ([461, 466, 462, 467].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([594, 646, 698].indexOf(shipId) >= 0) {
            add({ fp: 3 }, num)
        } else if ([599, 610].indexOf(shipId) >= 0) {
            add({ fp: 5 }, num)
        }
    }
    // 九七式艦攻改 試製三号戊型(空六号電探改装備機)
    if (num = itemNums[344]) {
        if ([599, 610].indexOf(shipId) >= 0) {
            add({ fp: 3 }, num)
        } else if ([555, 560].indexOf(shipId) >= 0) {
            add({ fp: 2, asw: 2 }, num)
        } else if (shipId === 318) {
            add({ fp: 4, asw: 1 }, num)
        } else if (shipId === 282) {
            add({ fp: 2, asw: 1 }, num)
        }
    }
    // 九七式艦攻改(熟練) 試製三号戊型(空六号電探改装備機)
    if (num = itemNums[345]) {
        if ([599, 610].indexOf(shipId) >= 0) {
            add({ fp: 3 }, num)
        } else if ([555, 560].indexOf(shipId) >= 0) {
            add({ fp: 3, asw: 2 }, num)
        } else if (shipId === 318) {
            add({ fp: 5, asw: 1 }, num)
        } else if (shipId === 282) {
            add({ fp: 3, asw: 1 }, num)
        }
    }
    // 8inch三連装砲 Mk.9
    // 8inch三連装砲 Mk.9 mod.2
    // if (num = itemNums[356] + itemNums[357]) {}
    // 5inch 単装高角砲群
    if (num = itemNums[358]) {
        if (US_CV_SHIPS.indexOf(ctype) >= 0 || UK_CV_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // 6inch 連装速射砲 Mk.XXI
    // if (num = itemNums[359]) {}
    // Bofors 15cm連装速射砲 Mk.9 Model 1938
    // Bofors 15cm連装速射砲 Mk.9改+単装速射砲 Mk.10改 Model 1938
    // if (num = itemNums[360] + itemNums[361]) {}
    // 5inch連装両用砲(集中配備)
    // GFCS Mk.37+5inch連装両用砲(集中配備)
    // if (num = itemNums[362] + itemNums[363]) {}
    // 甲標的 丁型改(蛟龍改)
    // if (num = itemNums[364]) {}
    // 一式徹甲弾改
    // if (num = itemNums[365]) {}
    // Swordfish(水上機型)
    if (num = itemNums[367]) {
        if (yomi === "ゴトランド") {
            add({ asw: 1 }, num)
        }
        if (ctype === 70) {
            add({ asw: 1 }, num)
        } else if ([72, 62].indexOf(ctype) >= 0) {
            // 使用箇所なし
        } else if (UK_CV_SHIPS.indexOf(ctype) >= 0) {
            // 現状搭載不可
            add({ fp: 2 }, num)
        }
    }
    // Swordfish Mk.III改(水上機型)
    if (num = itemNums[368]) {
        if (yomi === "ゴトランド") {
            add({ asw: 3 }, num)
        }
        if (ctype === 70) {
            add({ asw: 3 }, num)
        } else if ([72, 62].indexOf(ctype) >= 0) {
            add({ asw: 2 }, num)
        } else if (UK_SHIPS.indexOf(ctype) >= 0) {
            // 現状搭載不可
            add({ fp: (UK_CV_SHIPS.indexOf(ctype) >= 0 ? 2 : 0), asw: 2 }, num)
        }
    }
    // Swordfish Mk.III改(水上機型/熟練)
    if (num = itemNums[369]) {
        if (yomi === "ゴトランド") {
            add({ asw: 4 }, num)
        }
        if (ctype === 70) {
            add({ asw: 3 }, num)
        } else if ([72, 62].indexOf(ctype) >= 0) {
            add({ asw: 2 }, num)
        } else if (UK_SHIPS.indexOf(ctype) >= 0) {
            // 現状搭載不可
            add({ fp: 2, asw: 2 }, num)
        }
    }
    // Swordfish Mk.II改(水偵型)
    if (num = itemNums[370]) {
        if (yomi === "ゴトランド") {
            add({ asw: 3 }, num)
        }
        if (ctype === 70) {
            add({ asw: 3 }, num)
        } else if ([72, 62].indexOf(ctype) >= 0) {
            add({ asw: 2 }, num)
        } else if (UK_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 2, asw: 3 }, num)
        }
    }
    // Fairey Seafox改
    if (num = itemNums[371]) {
        if (yomi === "ゴトランド") {
            add({ asw: 2 }, num)
        }
        if (ctype === 70) {
            add({ asw: 1 }, num)
        } else if (ctype === 79) {
            // 使用箇所なし
        } else if (UK_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 3, asw: 1 }, num)
        }
    }
    // 天山一二型甲
    if (num = itemNums[372]) {
        if (["しょうかく", "ずいかく", "たいほう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
        } else if (["じゅんよう", "ひよう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
        }
        if ([108, 109, 291, 292, 296, 297].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([116, 74, 117, 282, 185].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num)
        } else if ([560, 555, 318].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num)
        } else if ([508, 509].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // 天山一二型甲改(空六号電探改装備機)
    if (num = itemNums[373]) {
        if (yomi === "しょうかく") {
            add({ fp: 2 }, num)
        } else if (yomi === "ずいかく") {
            add({ fp: 1 }, num)
        } else if (yomi === "たいほう") {
            add({ fp: 1 }, num)
        } else if (["じゅんよう", "ひよう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
        }
        if ([108, 109].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([291, 292].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([296, 297].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([116, 74].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num)
        } else if ([117, 282, 185].indexOf(shipId) >= 0) {
            add({ fp: 1, asw: 1 }, num)
        } else if ([560, 555, 318].indexOf(shipId) >= 0) {
            add({ fp: 1, asw: 2 }, num)
        } else if ([508, 509].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // 天山一二型甲改(熟練/空六号電探改装備機)
    if (num = itemNums[374]) {
        if (yomi === "しょうかく") {
            add({ fp: 3 }, num)
        } else if (yomi === "ずいかく") {
            add({ fp: 2 }, num)
        } else if (yomi === "たいほう") {
            add({ fp: 2 }, num)
        } else if (["じゅんよう", "ひよう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
        }
        if ([108, 109].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([291, 292].indexOf(shipId) >= 0) {
            add({ fp: 1, asw: 1 }, num)
        } else if ([296, 297].indexOf(shipId) >= 0) {
            add({ fp: 1, asw: 1 }, num)
        } else if ([116, 74].indexOf(shipId) >= 0) {
            add({ fp: 1, asw: 1 }, num)
        } else if ([117, 282, 185].indexOf(shipId) >= 0) {
            add({ fp: 1, asw: 2 }, num)
        } else if ([560, 555, 318].indexOf(shipId) >= 0) {
            add({ fp: 1, asw: 3 }, num)
        } else if ([508, 509].indexOf(shipId) >= 0) {
            add({ fp: 1, asw: 2 }, num)
        }
    }
    // XF5U
    if (num = itemNums[375]) {
        if (US_CV_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 3, asw: 3 }, num)
        }
        if (yomi === "かが") {
            add({ fp: 1, asw: 1 }, num)
        }
    }
    // 533mm五連装魚雷(後期型)
    // if (num = itemNums[376]) {}
    // RUR-4A Weapon Alpha改
    if (num = itemNums[377]) {
        if (US_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 2 }, num, 1)
            if (shipId === 629) {
                add({ asw: 1 }, num, 1)
            }
        } else if (UK_SHIPS.concat([96]).indexOf(ctype) >= 0) {
            add({ asw: 1 }, num, 1)
        }
    }
    // 対潜短魚雷(試作初期型)
    if (num = itemNums[378]) {
        if (US_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 3 }, num, 1)
            if (shipId === 629) {
                add({ asw: 1 }, num, 1)
            }
        } else if (UK_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 2 }, num, 1)
        } else if (ctype === 96) {
            add({ asw: 1 }, num, 1)
        } else if ([651, 656].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num, 1)
        }
    }
    // 12.7cm単装高角砲改二
    if (num = itemNums[379]) {
        if (["ゆら", "なか", "きぬ", "いすず", "ゆうばり"].indexOf(yomi) >= 0) {
            add({ asw: 1 }, num)
        }
        if (shipId === 656) {
            add({ asw: 2 }, num)
        }
        if ([488, 160, 487, 141].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num)
        }
        if ([477, 478, 624].indexOf(shipId) >= 0) {
            add({ asw: 2 }, num)
        }
    }
    // 12.7cm連装高角砲改二
    if (num = itemNums[380]) {
        if (["ゆら", "なか", "きぬ", "いすず", "ゆうばり"].indexOf(yomi) >= 0) {
            add({ asw: 1 }, num)
        }
        if ([488, 160, 487, 141].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num)
        }
        if ([477, 478, 624].indexOf(shipId) >= 0) {
            add({ asw: 2 }, num)
        }
    }
    // 16inch三連装砲 Mk.6
    // if (num = itemNums[381]) {}
    // 12cm単装高角砲E型
    if (num = itemNums[382]) {
        if (stype === 1) {
            add({ asw: 1 }, num)
        }
    }
    // 後期型53cm艦首魚雷(8門)
    // if (num = itemNums[383]) {}
    // 後期型潜水艦搭載電探&逆探
    // if (num = itemNums[384]) {}
    // 16inch三連装砲 Mk.6 mod.2
    // if (num = itemNums[385]) {}
    // 6inch三連装速射砲 Mk.16
    // if (num = itemNums[386]) {}
    // 6inch三連装速射砲 Mk.16 mod.2
    // if (num = itemNums[387]) {}
    // TBM-3W+3S
    if (num = itemNums[389]) {
        if ([594, 599].indexOf(shipId) >= 0) {
            add({ fp: 2 }, num)
        } else if ([698, 610].indexOf(shipId) >= 0) {
            add({ fp: 3 }, num)
        } else if (shipId === 646) {
            add({ fp: 4, asw: 4 }, num)
            if (items.some(function(item) { return item.type3 === 25 })) {
                add({ fp: 3, asw: 6 }, num, 1)
            }
            if (itemNums[326] + itemNums[327]) {
                add({ fp: 5, asw: 4 }, num, 1)
            }
        }
        if (US_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: (US_CV_SHIPS.indexOf(shipId) >= 0 ? 2 : 0), asw: 3 }, num)
        }
    }
    // 16inch三連装砲 Mk.6+GFCS
    // if (num = itemNums[390]) {}
    // 九九式艦爆二二型
    if (num = itemNums[391]) {
        if (["しょうかく", "ずいかく", "じゅんよう", "ひよう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
        }
        if ([116, 185, 282].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([117, 318].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        } else if ([560, 555].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // 九九式艦爆二二型(熟練)
    if (num = itemNums[392]) {
        if (["しょうかく", "ずいかく"].indexOf(yomi) >= 0) {
            add({ fp: 2 }, num)
        } else if (["じゅんよう", "ひよう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
        }
        if ([116, 185, 282].indexOf(shipId) >= 0) {
            add({ fp: 2 }, num)
        } else if ([117, 318].indexOf(shipId) >= 0) {
            add({ fp: 2 }, num)
        } else if ([560, 555].indexOf(shipId) >= 0) {
            add({ fp: 3 }, num)
        }
    }
    // 現地改装12.7cm連装高角砲
    // if (num = itemNums[397]) {}
    // 現地改装10cm連装高角砲
    // if (num = itemNums[398]) {}
    // 6inch Mk.XXIII三連装砲
    // if (num = itemNums[399]) {}
    // 533mm 三連装魚雷(53-39型)
    // if (num = itemNums[400]) {}
    // 15.2cm連装砲改二
    // if (num = itemNums[407]) {}

    return bonus
}

//#endregion

//#endregion

//#region polyfill

/**
 * Object.assign()代替
 */
function objectAssign() {
    var resObj = {}
    for(var i = 0; i < arguments.length; i++) {
         var obj = arguments[i]
         var keys = Object.keys(obj)
         for(var j = 0; j < keys.length; j++) {
             resObj[keys[j]] = obj[keys[j]]
         }
    }
    return resObj
}

//#endregion
