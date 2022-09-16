//#region Library
Calendar = Java.type("java.util.Calendar")
TimeZone = Java.type("java.util.TimeZone")
DataType = Java.type("logbook.data.DataType")
AppConstants = Java.type("logbook.constants.AppConstants")
BattlePhaseKind = Java.type("logbook.dto.BattlePhaseKind")
EnemyShipDto = Java.type("logbook.dto.EnemyShipDto")
ShipDto = Java.type("logbook.dto.ShipDto")
ShipParameters = Java.type("logbook.dto.ShipParameters")
Item = Java.type("logbook.internal.Item")
Ship = Java.type("logbook.internal.Ship")
//#endregion

//#region 全般

/** バージョン */
var VERSION = 2.80
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

// 赤仮用
if (isAkakari) {
    AkakariSyutsugekiLogReader = Java.type("logbook.builtinscript.akakariLog.AkakariSyutsugekiLogReader")
}

//#endregion

//#region 艦これ計算部分

//#region 定数箇所
/** 艦種 */
var STYPE = {
    /** 海防艦 */
    DE: 1,
    /** 駆逐艦 */
    DD: 2,
    /** 軽巡洋艦 */
    CL: 3,
    /** 重雷装巡洋艦 */
    CLT: 4,
    /** 重巡洋艦 */
    CA: 5,
    /** 航空巡洋艦 */
    CAV: 6,
    /** 軽空母 */
    CVL: 7,
    /** 巡洋戦艦(高速戦艦) */
    FBB: 8,
    /** 戦艦 */
    BB: 9,
    /** 航空戦艦 */
    BBV: 10,
    /** 正規空母 */
    CV: 11,
    /** 超弩級戦艦 */
    // BB:12,
    /** 潜水艦 */
    SS: 13,
    /** 潜水空母 */
    SSV: 14,
    /** 補給艦(敵) */
    E_AO: 15,
    /** 水上機母艦 */
    AV: 16,
    /** 揚陸艦 */
    LHA: 17,
    /** 装甲空母 */
    CVB: 18,
    /** 工作艦 */
    AR: 19,
    /** 潜水母艦 */
    AS: 20,
    /** 練習巡洋艦 */
    CT: 21,
    /** 補給艦 */
    AO: 22,
}
/** ドイツ艦 */
var GERMAN_SHIPS = [47, 48, 55, 57, 63]
/** イタリア艦 */
var ITALIAN_SHIPS = [58, 61, 64, 68, 80, 92, 113]
/** アメリカ艦 */
var AMERICAN_SHIPS = [65, 69, 83, 84, 87, 91, 93, 95, 99, 102, 105, 106, 107, 110, 114, 116]
/** イギリス艦 */
var BRITISH_SHIPS = [67, 78, 82, 88, 108, 112]
/** フランス艦 */
var FRENCH_SHIPS = [70, 79]
/** ロシア艦 */
var RUSSIAN_SHIPS = [73, 81]
/** スウェーデン艦 */
var SWEDISH_SHIPS = [89]
/** オランダ艦 */
var DUTCH_SHIPS = [98]
/** オーストラリア艦 */
var AUSTRALIAN_SHIPS = [96]
/** 海外艦 */
var OVERSEA_SHIPS = [].concat(
    GERMAN_SHIPS,
    ITALIAN_SHIPS,
    AMERICAN_SHIPS,
    BRITISH_SHIPS,
    FRENCH_SHIPS,
    RUSSIAN_SHIPS,
    SWEDISH_SHIPS,
    DUTCH_SHIPS,
    AUSTRALIAN_SHIPS
)
/** 日本駆逐艦 */
var JAPANESE_DD_SHIPS = [66, 28, 12, 1, 5, 10, 23, 18, 30, 38, 22, 54, 101]
//#endregion

/**
 * 昼戦火力算出
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.MapCellDto} mapCell マップ
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
var getDayBattlePower = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    if (isSubMarine(defender)) {
        // 対潜水艦
        return new AntiSubmarinePower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    } else {
        // 対水上艦
        return new DayBattlePower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    }
}

/**
 * 雷撃戦火力算出
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.MapCellDto} mapCell マップ
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
var getTorpedoPower = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp) {
    return new TorpedoPower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp)
}

/**
 * 夜戦火力算出
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.MapCellDto} mapCell マップ
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
var getNightBattlePower = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, touchPlane, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    if (isSubMarine(defender)) {
        // 対潜水艦
        return new AntiSubmarinePower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    } else {
        // 対水上艦
        return new NightBattlePower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, touchPlane, attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
    }
}

/**
 * レーダー射撃戦火力算出
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.MapCellDto} mapCell マップ
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
var getRadarShootingPower = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    if (isSubMarine(defender)) {
        // 対潜水艦
        return new AntiSubmarinePower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins, true)
    } else {
        // 対水上艦
        return new NightBattlePower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, [-1, -1], attack, attacker, defender, attackerHp, shouldUseSkilled, origins)
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

    // 速吸改
    if (attacker.shipId === 352) {
        if (isSubMarine(defender)) {
            if (getItems(attacker).some(function (item) { return item.type2 === 8 && item.param.taisen > 0 || item.type2 === 11 || item.type2 === 25 })) {
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

    // 山汐丸、山汐丸改
    if ([717, 900].indexOf(attacker.shipId) >= 0) {
        if (isSubMarine(defender)) {
            // 艦上爆撃機、艦上攻撃機、水上爆撃機、オートジャイロ、対潜哨戒機、大型飛行艇
            if (getItems(attacker).some(function (item) { return [7, 8, 11, 25, 26, 41].indexOf(item.type2) >= 0 && item.param.taisen >= 1 })) {
                return 1
            } else {
                return 2
            }
        }
        // 艦上爆撃機、艦上攻撃機
        if (getItems(attacker).some(function (item) { return [7, 8].indexOf(item.type2) >= 0 })) {
            return 1
        }
        return 0
    }
    // 軽空母、正規空母、装甲空母
    if ([STYPE.CVL, STYPE.CV, STYPE.CVB].indexOf(attacker.stype) >= 0) {
        return 1
    }

    if (isSubMarine(defender)) {
        // 航空巡洋艦、航空戦艦、水上機母艦、揚陸艦
        if ([STYPE.CAV, STYPE.BBV, STYPE.AV, STYPE.LHA].indexOf(attacker.stype) >= 0) {
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

    // 軽空母、加賀改二護
    if (attacker.stype === STYPE.CVL || attacker.shipId === 646) {
        if (isSubMarine(defender)) {
            return 2
        }
    }
    // 軽空母、正規空母、装甲空母
    if ([STYPE.CVL, STYPE.CV, STYPE.CVB].indexOf(attacker.stype) >= 0) {
        // Graf Zeppelin改、Graf Zeppelin、Saratoga
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
        // 航空巡洋艦、航空戦艦、水上機母艦、揚陸艦
        if ([STYPE.CAV, STYPE.BBV, STYPE.AV, STYPE.LHA].indexOf(attacker.stype) >= 0) {
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
    return ship.stype === STYPE.SS || ship.stype === STYPE.SSV
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
var isPtImpPack = function (ship) {
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
 * @param {logbook.dto.MapCellDto} mapCell マップ
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
var AntiSubmarinePower = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins, isRadarShooting) {
    this.date = date
    this.mapCell = mapCell
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
     * 2021/03/01 メンテ後:170
     */
    this.CAP_VALUE = 100
    if (this.date.after(getJstDate(2017, 11, 10, 17, 7, 0))) {
        this.CAP_VALUE = 150
    }
    if (this.date.after(getJstDate(2021, 3, 1, 12, 0, 0))) {
        this.CAP_VALUE = 170
    }
}

/**
 * 対潜火力(基本攻撃力)を返します
 * @param {Boolean} formulaMode 計算式モード
 * @return {Number|String} 対潜火力(基本攻撃力)
 */
AntiSubmarinePower.prototype.getBasicPower = function (formulaMode) {
    // レーダー射撃戦専用処理
    if (this.isRadarShooting) {
        if (formulaMode) {
            return "sqrt(" + this.attacker.raisou + ")*2" 
        }
        return Math.sqrt(this.attacker.raisou) * 2
    }
    var equipmentBonus = getEquipmentBonus(this.date, this.attacker).asw
    var taisenShip = this.attacker.taisen - getSlotParam(this.attacker).taisen - equipmentBonus
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
    // あまりこの書き方好きじゃない
    if (this.date.after(getJstDate(2021, 9, 28, 12, 0, 0))) {
        taisenItem += equipmentBonus
    }
    if (formulaMode) {
        return "sqrt(" + taisenShip + ")*2+" + taisenItem + "*1.5+" + this.getImprovementBonus() + "+" + this.getShipTypeConstant()
    }
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
                // 爆戦、「彗星一二型(三一号光電管爆弾搭載機)」は改修効果が異なる
                return [
                    23,  // 九九式艦爆
                    24,  // 彗星
                    57,  // 彗星一二型甲
                    99,  // 九九式艦爆(江草隊)
                    100, // 彗星(江草隊)
                    148, // 試製南山
                    195, // SBD
                    248, // Skua
                    316, // Re.2001 CB改
                    391, // 九九式艦爆二二型
                    392, // 九九式艦爆二二型(熟練)
                    419, // SBD-5
                    420, // SB2C-3
                    421  // SB2C-5
                ].indexOf(item.slotitemId) >= 0 ? 0.2 * item.level : 0
            case 8: // 艦上攻撃機
                return 0.2 * item.level
            case 14: // ソナー
            case 15: // 爆雷
            case 40: // 大型ソナー
                return Math.sqrt(item.level)
            case 25: // 回転翼機
                return (item.param.taisen > 10 ? 0.3 : 0.2) * item.level
            case 26: // 対潜哨戒機
                switch (item.slotitemId) {
                    case 70: // 三式指揮連絡機
                        return 0.2 * item.level
                    case 451: // 三式指揮連絡機改
                        return 0.3 * item.level
                }
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
    var sonar = this.items.some(function (item) { return item.type3 === 17 })
    var depthChargeCategory = this.items.some(function (item) { return item.type3 === 18 })

    return sonar && depthChargeCategory ? 1.15 : 1
}

/**
 * 対潜シナジー倍率を取得します(艦これ本体の仕様に合わせるため分離)
 * @return {Number} 対潜シナジー倍率
 */
AntiSubmarinePower.prototype.getSynergyBonus2 = function () {
    var MYSTERY_FIXED_DATE = getJstDate(2019, 8, 8, 12, 0, 0)
    var NEW_SYNERGY_DATE = getJstDate(2021, 10, 29, 12, 0, 0)

    // 九四式爆雷投射機
    // 三式爆雷投射機
    // 三式爆雷投射機 集中配備
    // 試製15cm9連装対潜噴進砲
    // RUR-4A Weapon Alpha改
    // Mk.32 対潜魚雷(Mk.2落射機)
    var depthChargeProjectorList = this.date.after(NEW_SYNERGY_DATE) ? [44, 45, 287, 288, 377, 472] : [44, 45]
    // 九五式爆雷
    // 二式爆雷
    // 対潜短魚雷(試作初期型)
    // Hedgehog(初期型)
    var depthChargeList = this.date.after(NEW_SYNERGY_DATE) ? [226, 227, 378, 439] : this.date.after(MYSTERY_FIXED_DATE) ? [226, 227] : [226, 227, 228]
    var depthChargeProjector = this.items.some(function (item) { return depthChargeProjectorList.indexOf(item.slotitemId) >= 0 })
    var depthCharge = this.items.some(function (item) { return depthChargeList.indexOf(item.slotitemId) >= 0 })
    var smallSonar = this.items.some(function (item) { return item.type2 === 14 })

    if (smallSonar && depthChargeProjector && depthCharge) {
        // 小型ソナー/爆雷投射機/爆雷シナジー
        return 1.25
    }
    if (depthChargeProjector && depthCharge) {
        // 爆雷投射機/爆雷シナジー
        return 1.1
    }
    return 1
}

/**
 * 対潜火力(キャップ前)を返します
 * @param {Boolean} formulaMode 計算式モード
 * @return {Number|String} 対潜火力(キャップ前)
 */
AntiSubmarinePower.prototype.getPrecapPower = function (formulaMode) {
    if (formulaMode) {
        return "(" + this.getBasicPower() + ")*" + getEngagementBonus(this.formation) + "*" + this.getFormationBonus() + "*" + this.getConditionBonus() + "*" + this.getSynergyBonus() + "*" + this.getSynergyBonus2()
    }
    return this.getBasicPower() * getEngagementBonus(this.formation) * this.getFormationBonus() * this.getConditionBonus() * this.getSynergyBonus() * this.getSynergyBonus2()
}

/**
 * 対潜火力(キャップ後)を返します
 * @param {Boolean} formulaMode 計算式モード
 * @return {[Number,Number]|String} 対潜火力(キャップ後)
 */
AntiSubmarinePower.prototype.getPostcapPower = function (formulaMode) {
    var v = Math.floor(Math.floor(getPostcapValue(this.getPrecapPower(), this.CAP_VALUE)) * getMapBonus(this.mapCell, this.attacker, this.defender)) * getCriticalBonus(this.attack)
    var s = this.shouldUseSkilled ? getSkilledBonus(this.date, this.attack, this.attacker, this.defender, this.attackerHp) : [1.0, 1.0]
    if (formulaMode) {
        return "int(int(int(" + getPostcapValue(this.getPrecapPower(), this.CAP_VALUE) + ")*" + getMapBonus(this.mapCell, this.attacker, this.defender) + ")*" + getCriticalBonus(this.attack) + "*" + s[0] + ")"
    }
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
        case FORMATION.ECHELON: return this.date.after(CHANGE_ECHELON_BONUS_DATE) ? 1.1 : 1.0
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
 * @param {logbook.dto.MapCellDto} mapCell マップ
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
var DayBattlePower = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    this.date = date
    this.mapCell = mapCell
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
    if (this.date.after(getJstDate(2017, 3, 17, 12, 0, 0))) {
        this.CAP_VALUE = 180
    }
    if (this.date.after(getJstDate(2021, 3, 1, 12, 0, 0))) {
        this.CAP_VALUE = 220
    }
}

/**
 * 昼砲撃火力(基本攻撃力)を返します
 * @param {Boolean} formulaMode 計算式モード
 * @return {Number|String} 昼砲撃火力(基本攻撃力)
 */
DayBattlePower.prototype.getBasicPower = function (formulaMode) {
    var landBonus = getLandBonus(this.attacker, this.defender, true)
    // 空撃または陸上型かつ艦上爆撃機,艦上攻撃機,陸上攻撃機,噴式戦闘爆撃機,噴式攻撃機所持時?
    if (getAttackTypeAtDay(this.attack, this.attacker, this.defender) === 1 || isGround(this.attacker) && this.items.some(function (item) { return [7, 8, 47, 57, 58].indexOf(item.type2) >= 0 })) {
        // 空撃
        var slotParam = getSlotParam(this.attacker)
        var rai = slotParam.raig + (this.date.after(getJstDate(2021, 8, 4, 12, 0, 0)) ? getEquipmentBonus(this.date, this.attacker).tp : 0)
        var baku = slotParam.baku + getEquipmentBonus(this.date, this.attacker).bomb
        if (isGround(this.defender)) {
            rai = 0
            if (this.date.after(getJstDate(2019, 3, 27, 12, 0, 0))) {
                var landAttacker = this.date.after(getJstDate(2021, 7, 15, 12, 0, 0)) ?
                    // Ju87C改, 試製南山, F4U-1D, FM-2, Ju87C改二(KMX搭載機), Ju87C改二(KMX搭載機/熟練), 彗星一二型(六三四空/三号爆弾搭載機), TBM-3W+3S, 九九式艦爆二二型, 九九式艦爆二二型(熟練), 彗星一二型(三一号光電管爆弾搭載機), SB2C-3, SB2C-5, F4U-4
                    [64, 148, 233, 277, 305, 306, 319, 389, 391, 392, 320, 420, 421, 474] :
                    // Ju87C改, 試製南山, F4U-1D, FM-2, Ju87C改二(KMX搭載機), Ju87C改二(KMX搭載機/熟練), 彗星一二型(六三四空/三号爆弾搭載機), TBM-3W+3S
                    [64, 148, 233, 277, 305, 306, 319, 389]
                baku = this.items.filter(function (item) {
                    return landAttacker.indexOf(item.slotitemId) >= 0
                }).reduce(function(p, v) {
                    return p + v.param.baku
                }, 0)
            }
        }
        if (formulaMode) {
            return "25+int(1.5*(((((((5+" + this.attacker.karyoku + "+" + this.getImprovementBonus() + "+" + this.getCombinedPowerBonus() + ")*" + landBonus.stypeBonus.a + "+" + landBonus.stypeBonus.b + ")*" + landBonus.basicBonus.a + "*" + landBonus.shikonBonus.a + "+" + landBonus.shikonBonus.b + ")*" + landBonus.m4a1ddBonus.a + "+" + landBonus.m4a1ddBonus.b + ")*" + landBonus.issikihouBonus.a + "+" + landBonus.issikihouBonus.b + ")*" + landBonus.supportBonus.a + "+" + landBonus.supportBonus.b + "+" + landBonus.basicBonus.b + ")+int(int(" + baku  + "*1.3)+" + rai + ")+15))"
        }
        return 25 + Math.floor(1.5 * (((((((5 + this.attacker.karyoku + this.getImprovementBonus() + this.getCombinedPowerBonus()) * landBonus.stypeBonus.a + landBonus.stypeBonus.b) * landBonus.basicBonus.a * landBonus.shikonBonus.a + landBonus.shikonBonus.b) * landBonus.m4a1ddBonus.a + landBonus.m4a1ddBonus.b) * landBonus.issikihouBonus.a + landBonus.issikihouBonus.b) * landBonus.supportBonus.a + landBonus.supportBonus.b + landBonus.basicBonus.b) + Math.floor(Math.floor(baku * 1.3) + rai) + 15))
    } else {
        // 砲撃
        if (formulaMode) {
            return "(((((" + this.attacker.karyoku + "+" + this.getImprovementBonus() + "+" + this.getCombinedPowerBonus() + "+5)*" + landBonus.stypeBonus.a + "+" + landBonus.stypeBonus.b + ")*" + landBonus.basicBonus.a + "*" + landBonus.shikonBonus.a + "+" + landBonus.shikonBonus.b + ")*" + landBonus.m4a1ddBonus.a + "+" + landBonus.m4a1ddBonus.b + ")*" + landBonus.issikihouBonus.a + "+" + landBonus.issikihouBonus.b + ")*" + landBonus.supportBonus.a + "+" + landBonus.supportBonus.b + "+" + landBonus.basicBonus.b
        }
        return (((((this.attacker.karyoku + this.getImprovementBonus() + this.getCombinedPowerBonus() + 5) * landBonus.stypeBonus.a + landBonus.stypeBonus.b) * landBonus.basicBonus.a * landBonus.shikonBonus.a + landBonus.shikonBonus.b) * landBonus.m4a1ddBonus.a + landBonus.m4a1ddBonus.b) * landBonus.issikihouBonus.a + landBonus.issikihouBonus.b) * landBonus.supportBonus.a + landBonus.supportBonus.b + landBonus.basicBonus.b
    }
}

/**
 * 昼砲撃改修火力を返します
 * @return {Number} 昼砲撃改修火力
 */
DayBattlePower.prototype.getImprovementBonus = function () {
    var CHANGE_SUB_GUN_BONUS_DATE = getJstDate(2017, 3, 17, 12, 0, 0)
    var RECHANGE_SUB_GUN_BONUS_DATE = getJstDate(2017, 5, 2, 12, 0, 0)
    var isAirAttack = getAttackTypeAtDay(this.attack, this.attacker, this.defender) === 1
    return this.items.map(function (item) {
        var modifier = (function () {
            switch (item.type2) {
                case 1:  return 1    // 小口径主砲
                case 2:  return 1    // 中口径主砲
                case 3:  return 1.5  // 大口径主砲
                case 38: return 1.5  // 大口径主砲(II)
                case 4:  return 1    // 副砲
                case 19: return 1    // 対艦強化弾
                case 36: return 1    // 高射装置
                case 29: return 1    // 探照灯
                case 42: return 1    // 大型探照灯
                case 21: return 1    // 機銃
                case 15:             // 爆雷(投射機)
                    // 九五式爆雷、二式爆雷は0
                    return [226, 227].indexOf(item.slotitemId) < 0 ? 0.75 : 0
                case 14: return 0.75 // ソナー
                case 40: return 0.75 // 大型ソナー
                case 24: return 1    // 上陸用舟艇
                case 46: return 1    // 特二式内火艇
                case 18: return 1    // 三式弾
                case 37: return 1    // 対地装備
                case 39: return 1    // 水上艦要員
                case 34: return 1    // 司令部施設
                case 32: return 1    // 潜水艦魚雷
                case 35: return 1    // 航空要員
                default: return 0
            }
        })()
        // 副砲
        if (item.type2 === 4) {
            // 2017/3/17～2017/5/2
            if (this.date.after(CHANGE_SUB_GUN_BONUS_DATE) && this.date.before(RECHANGE_SUB_GUN_BONUS_DATE)) {
                switch (item.type3) {
                    case 4: return 0.3 * item.level // (黄色)副砲
                    case 16: return 0.2 * item.level // (緑)高角副砲
                }
            } else {
                switch (item.slotitemId) {
                    case 10:  // 12.7cm連装高角砲
                    case 66:  // 8cm高角砲
                    case 220: // 8cm高角砲改+増設機銃
                    case 275: // 10cm連装高角砲改+増設機銃
                    case 358: // 5inch 単装高角砲群
                        return 0.2 * item.level
                    case 12:  // 15.5cm三連装副砲
                    case 234: // 15.5cm三連装副砲改
                    case 247: // 15.2cm三連装砲
                    case 467: // 5inch連装砲(副砲配置) 集中配備
                        return 0.3 * item.level
                }
            }
        }
        // 艦上攻撃機
        if (item.type2 === 8) {
            return 0.2 * item.level
        }
        // 艦上爆撃機
        if (item.type2 === 7) {
            // 航空砲撃でなければ加算しない
            if (isAirAttack) {
                // 爆戦、「彗星一二型(三一号光電管爆弾搭載機)」は改修効果が異なる
                return [
                    23,  // 九九式艦爆
                    24,  // 彗星
                    57,  // 彗星一二型甲
                    99,  // 九九式艦爆(江草隊)
                    100, // 彗星(江草隊)
                    148, // 試製南山
                    195, // SBD
                    248, // Skua
                    316, // Re.2001 CB改
                    391, // 九九式艦爆二二型
                    392, // 九九式艦爆二二型(熟練)
                    419, // SBD-5
                    420, // SB2C-3
                    421  // SB2C-5
                ].indexOf(item.slotitemId) >= 0 ? 0.2 * item.level : 0
            }
            return 0
        }
        return modifier * Math.sqrt(item.level)
    }, this).reduce(function (prev, current) {
        return prev + current
    }, 0)
}

/**
 * 昼砲撃火力(キャップ前)を返します
 * @param {Boolean} formulaMode 計算式モード
 * @return {Number|String} 昼砲撃火力(キャップ前)
 */
DayBattlePower.prototype.getPrecapPower = function (formulaMode) {
    if (formulaMode) {
        return "(" + this.getBasicPower() + ")*" + getEngagementBonus(this.formation) + "*" + this.getFormationBonus() + "*" + this.getConditionBonus() + "+" + getOriginalGunPowerBonus(this.attacker, this.date)
    }
    return this.getBasicPower() * getEngagementBonus(this.formation) * this.getFormationBonus() * this.getConditionBonus() + getOriginalGunPowerBonus(this.attacker, this.date)
}

/**
 * 昼砲撃火力(キャップ後)を返します
 * @param {Boolean} formulaMode 計算式モード
 * @return {[Number,Number]|String} 昼砲撃火力(キャップ後)
 */
DayBattlePower.prototype.getPostcapPower = function (formulaMode) {
    // サイレント修正(Twitterで確認した限りでは17/9/9が最古=>17夏イベ?)以降、集積地棲姫特効のキャップ位置が変化(a5→a6)
    // 17夏以降に登場したPT小鬼群の特効位置もa6に変化?(乗算と加算組み合わせているっぽいので詳細不明)
    // A = [([キャップ後攻撃力] * 乗算特効補正 + 加算特効補正) * 乗算特効補正2 * マップ補正] * 弾着観測射撃 * 戦爆連合カットイン攻撃
    var value = Math.floor((Math.floor(getPostcapValue(this.getPrecapPower(), this.CAP_VALUE)) * getMultiplySlayerBonus(this.attacker, this.defender) + getAddSlayerBonus(this.attacker, this.defender)) * getMultiplySlayerBonus2(this.attacker, this.defender) * getMapBonus(this.mapCell, this.attacker, this.defender)) * this.getSpottingBonus() * this.getUnifiedBombingBonus()
    var str = "int((int(" + getPostcapValue(this.getPrecapPower(), this.CAP_VALUE) + ")*" + getMultiplySlayerBonus(this.attacker, this.defender) + "+" + getAddSlayerBonus(this.attacker, this.defender) + ")*" + getMultiplySlayerBonus2(this.attacker, this.defender) + "*" + getMapBonus(this.mapCell, this.attacker, this.defender) + ")*" + this.getSpottingBonus() + "*" + this.getUnifiedBombingBonus()
    // 徹甲弾補正判定
    if (this.isAPshellBonusTarget()) {
        // A = [A * 徹甲弾補正]
        value = Math.floor(value * this.getAPshellBonus())
        str = "int((" + str + ")*" + this.getAPshellBonus() + ")"
    }
    // クリティカル判定
    if (isCritical(this.attack)) {
        // A = [A * クリティカル補正 * 熟練度補正]
        value *= getCriticalBonus(this.attack)
        str = "(" + str + ")*" + getCriticalBonus(this.attack)
        var skilled = this.shouldUseSkilled ? getSkilledBonus(this.date, this.attack, this.attacker, this.defender, this.attackerHp) : [1.0, 1.0]
        if (formulaMode) {
            str = "int((" + str + ")*" + skilled[0] + ")"
        }
        return [Math.floor(value * skilled[0]), Math.floor(value * skilled[1])]
    }
    if (formulaMode) {
        return str
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
            return this.date.after(CHANGE_ECHELON_BONUS_DATE) &&
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
    // 重巡洋艦、航空巡洋艦、巡洋戦艦、戦艦、航空戦艦、正規空母、装甲空母 ※超弩級戦艦は謎
    return [STYPE.CA, STYPE.CAV, STYPE.BB, STYPE.FBB, STYPE.BBV, STYPE.CV, STYPE.CVB].indexOf(this.defender.stype) >= 0
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
 * @param {logbook.dto.MapCellDto} mapCell マップ
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
var TorpedoPower = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, attacker, defender, attackerHp) {
    this.date = date
    this.mapCell = mapCell
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
    if (this.date.after(getJstDate(2021, 3, 1, 12, 0, 0))) {
        this.CAP_VALUE = 180
    }
}

/**
 * 雷撃火力(基本攻撃力)を返します
 * @param {Boolean} formulaMode 計算式モード
 * @return {Number|String} 雷撃火力(基本攻撃力)
 */
TorpedoPower.prototype.getBasicPower = function (formulaMode) {
    if (formulaMode) {
        return this.attacker.raisou + "+" + this.getImprovementBonus() + "+" + this.getCombinedPowerBonus() + "+5"
    }
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
            case 32: // 潜水艦魚雷
                if (this.date.after(getJstDate(2022, 1, 21, 12, 0, 0))) {
                    return 0.2 * item.level
                }
                return 0
            default:
                return 0
        }
    }, this).reduce(function (prev, current) {
        return prev + current
    }, 0)
}

/**
 * 雷撃火力(キャップ前)を返します
 * @param {Boolean} formulaMode 計算式モード
 * @return {Number|String} 雷撃火力(キャップ前)
 */
TorpedoPower.prototype.getPrecapPower = function (formulaMode) {
    if (formulaMode) {
        return "(" + this.getBasicPower() + ")*" + getEngagementBonus(this.formation) + "*" + this.getFormationBonus() + "*" + this.getConditionBonus()
    }
    return this.getBasicPower() * getEngagementBonus(this.formation) * this.getFormationBonus() * this.getConditionBonus()
}

/**
 * 雷撃火力(キャップ後)を返します
 * @param {Boolean} formulaMode 計算式モード
 * @return {[Number,Number]|String} 雷撃火力(キャップ後)
 */
TorpedoPower.prototype.getPostcapPower = function (formulaMode) {
    // A = [[([キャップ後攻撃力] * 乗算特効補正 + 加算特効補正) * 乗算特効補正2 * マップ補正] * クリティカル補正]
    var value = getPostcapValue(this.getPrecapPower(), this.CAP_VALUE)
    var result = Math.floor(Math.floor((Math.floor(value) * getMultiplySlayerBonus(this.attacker, this.defender) + getAddSlayerBonus(this.attacker, this.defender)) * getMultiplySlayerBonus2(this.attacker, this.defender) * getMapBonus(this.mapCell, this.attacker, this.defender)) * getCriticalBonus(this.attack))
    if (formulaMode) {
        return "int(int((int(" + value + ")*" + getMultiplySlayerBonus(this.attacker, this.defender) + "+" + getAddSlayerBonus(this.attacker, this.defender) + ")*" + getMultiplySlayerBonus2(this.attacker, this.defender) + "*" + getMapBonus(this.mapCell, this.attacker, this.defender) + ")*" + getCriticalBonus(this.attack) + ")"
    }
    return [result, result]
}

/**
 * 雷撃陣形補正を返します
 * @return {Number} 倍率
 */
TorpedoPower.prototype.getFormationBonus = function () {
    switch (this.formation[this.attack.friendAttack ? 0 : 1]) {
        case FORMATION.LINE_AHEAD:           return 1.0
        case FORMATION.DOUBLE_LINE:          return 0.8
        case FORMATION.DIAMOND:              return 0.7
        case FORMATION.ECHELON:              return 0.6
        case FORMATION.LINE_ABREAST:         return 0.6
        case FORMATION.VANGUARD:             return 1.0
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
 * @param {logbook.dto.MapCellDto} mapCell マップ
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
var NightBattlePower = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, touchPlane, attack, attacker, defender, attackerHp, shouldUseSkilled, origins) {
    this.date = date
    this.mapCell = mapCell
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
    if (this.date.after(getJstDate(2021, 3, 1, 12, 0, 0))) {
        this.CAP_VALUE = 360
    }
}

/**
 * 夜戦火力(基本攻撃力)を返します
 * @param {Boolean} formulaMode 計算式モード
 * @return {Number|String} 夜戦火力(基本攻撃力)
 */
NightBattlePower.prototype.getBasicPower = function (formulaMode) {
    var useRaisou = !isGround(this.defender) || isNorthernmostLandingPrincess(this.defender) || this.items.length === 0
    // 夜襲
    if (isNightCvAttack(this.attacker, this.attackerHp)) {
        var fp = getRawFirePower(this.date, this.attacker)
        var tpBonus = this.date.after(getJstDate(2021, 8, 4, 12, 0, 0)) ? getEquipmentBonus(this.date, this.attacker).tp : 0
        var bombBonus = getEquipmentBonus(this.date, this.attacker).bomb
        var nightPlaneBonus = Java.from(this.attacker.item2.toArray()).map(function (item, i) {
            var slot = getOnSlot(this.attacker, this.date)[i]
            if (item !== null && slot > 0) {
                // 夜戦、夜攻
                if (item.type3 === 45 || item.type3 === 46) {
                    // 夜爆出てきたらまた書き換え(TBM-3S+3Wの爆装は直接加算されない)
                    // 火力+雷装+3*機数+0.45*(火力+雷装+爆装+対潜)*sqrt(機数)+sqrt(★) ※改修分はgetImprovementBonus()で記載
                    return item.param.karyoku + (useRaisou ? item.param.raisou : 0) + 3 * slot + 0.45 * (item.param.karyoku + item.param.raisou + item.param.baku + item.param.taisen) * Math.sqrt(slot)
                }
                // 零戦62型(爆戦/岩井隊)、Swordfish、Swordfish Mk.II(熟練)、Swordfish Mk.III(熟練)、彗星一二型(三一号光電管爆弾搭載機)
                if ([154, 242, 243, 244, 320].indexOf(item.slotitemId) >= 0) {
                    // 火力+雷装+爆装+0.3*(火力+雷装+爆装+対潜)*sqrt(機数)+sqrt(★) ※改修分はgetImprovementBonus()で記載
                    return item.param.karyoku + (useRaisou ? item.param.raisou : 0) + item.param.baku + 0.3 * (item.param.karyoku + item.param.raisou + item.param.baku + item.param.taisen) * Math.sqrt(slot)
                }
            }
            return 0
        }, this).reduce(function (p, c) { return p + c }, 0)
        if (formulaMode) {
            return fp + "+" + tpBonus + "+" + bombBonus + "+" + nightPlaneBonus + "+" + this.getImprovementBonus() + "+" + this.getNightTouchPlaneBonus()
        }
        return fp + tpBonus + bombBonus + nightPlaneBonus + this.getImprovementBonus() + this.getNightTouchPlaneBonus()
    }
    // 通常砲撃 or Ark Royal特殊砲撃
    var power = (function (attacker, items, date) {
        // Ark Royal、Ark Royal改
        if ([393, 515].indexOf(attacker.shipId) >= 0) {
            var swordfishBonus = items.map(function (item) {
                // Swordfish、Swordfish Mk.II(熟練)、Swordfish Mk.III(熟練)
                if ([242, 243, 244].indexOf(item.slotitemId) >= 0) {
                    return item.param.karyoku + (useRaisou ? item.param.raisou : 0)
                }
                return 0
            }).reduce(function (p, c) { return p + c }, 0)
            return getRawFirePower(date, attacker) + swordfishBonus
        }
        return attacker.karyoku + (useRaisou ? attacker.raisou : 0)
    })(this.attacker, this.items, this.date)
    var landBonus = getLandBonus(this.attacker, this.defender, false)
    if (formulaMode) {
        return "((((((" + power + "+" + this.getImprovementBonus() + "+" + this.getNightTouchPlaneBonus() + ")*" + landBonus.stypeBonus.a + "+" + landBonus.stypeBonus.b + ")*" + landBonus.basicBonus.a + ")*" + landBonus.shikonBonus.a + "+" + landBonus.shikonBonus.b + ")*" + landBonus.m4a1ddBonus.a + "+" + landBonus.m4a1ddBonus.b + ")*" + landBonus.issikihouBonus.a + "+" + landBonus.issikihouBonus.b + ")*" + landBonus.supportBonus.a + "+" + landBonus.supportBonus.b + "+" + landBonus.basicBonus.b
    }
    return ((((((power + this.getImprovementBonus() + this.getNightTouchPlaneBonus()) * landBonus.stypeBonus.a + landBonus.stypeBonus.b) * landBonus.basicBonus.a) * landBonus.shikonBonus.a + landBonus.shikonBonus.b) * landBonus.m4a1ddBonus.a + landBonus.m4a1ddBonus.b) * landBonus.issikihouBonus.a + landBonus.issikihouBonus.b) * landBonus.supportBonus.a + landBonus.supportBonus.b + landBonus.basicBonus.b
}

/**
 * 夜戦改修火力を返します
 * @return {Number} 夜戦改修火力
 */
NightBattlePower.prototype.getImprovementBonus = function () {
    var CHANGE_SUB_GUN_BONUS_DATE = getJstDate(2017, 3, 17, 12, 0, 0)
    var RECHANGE_SUB_GUN_BONUS_DATE = getJstDate(2017, 5, 2, 12, 0, 0)
    
    // 夜襲
    if (isNightCvAttack(this.attacker, this.attackerHp)) {
        return Java.from(this.attacker.item2.toArray()).map(function (item, i) {
            var slot = getOnSlot(this.attacker, this.date)[i]
            if (item !== null && slot > 0) {
                // 夜戦、夜攻、零戦62型(爆戦/岩井隊)、Swordfish、Swordfish Mk.II(熟練)、Swordfish Mk.III(熟練)、彗星一二型(三一号光電管爆弾搭載機)
                if (item.type3 === 45 || item.type3 === 46 || [154, 242, 243, 244, 320].indexOf(item.slotitemId) >= 0) {
                    return Math.sqrt(item.level)
                }
            }
            return 0
        }, this).reduce(function (p, c) { return p + c }, 0)
        + this.items.map(function (item) {
            // 熟練甲板要員+航空整備員
            if (item.slotitemId === 478) {
                return 0.7 * Math.sqrt(item.level)
            }
            return 0
        }).reduce(function (p, c) { return p + c }, 0)
    }
    // Ark Royal、Ark Royal改
    if ([393, 515].indexOf(this.attacker.shipId) >= 0) {
        return this.items.map(function (item) {
            // Swordfish、Swordfish Mk.II(熟練)、Swordfish Mk.III(熟練)
            if ([242, 243, 244].indexOf(item.slotitemId) >= 0) {
                return Math.sqrt(item.level)
            }
            return 0
        }).reduce(function (p, c) { return p + c }, 0)
    }
    // 通常砲撃
    return this.items.map(function (item) {
        var modifier = (function () {
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
                case 39: return 1 // 水上艦要員
                case 34: return 1 // 司令部施設
                case 35: return 1 // 航空要員
                default: return 0
            }
        })()
        // 2022/1/21～
        if (this.date.after(getJstDate(2022, 1, 21, 12, 0, 0))) {
            // 潜水艦魚雷
            if (item.type2 === 32) {
                return 0.2 * item.level
            }
        }
        // 2017/3/17～2017/5/2
        if (this.date.after(CHANGE_SUB_GUN_BONUS_DATE) && this.date.before(RECHANGE_SUB_GUN_BONUS_DATE)) {
            switch (item.type3) {
                case 4: return 0.3 * item.level // 副砲
                case 16: return 0.2 * item.level // 高角副砲
            }
        } else {
            switch (item.slotitemId) {
                case 10:  // 12.7cm連装高角砲
                case 66:  // 8cm高角砲
                case 220: // 8cm高角砲改+増設機銃
                case 275: // 10cm連装高角砲改+増設機銃
                case 358: // 5inch 単装高角砲群
                    return 0.2 * item.level
                case 12:  // 15.5cm三連装副砲
                case 234: // 15.5cm三連装副砲改
                case 247: // 15.2cm三連装砲
                case 467: // 5inch連装砲(副砲配置) 集中配備
                    return 0.3 * item.level
            }
        }
        return modifier * Math.sqrt(item.level)
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
 * @param {Boolean} formulaMode 計算式モード
 * @return {Number|String} 夜戦火力(キャップ前)
 */
NightBattlePower.prototype.getPrecapPower = function (formulaMode) {
    if (formulaMode) {
        return "(" + this.getBasicPower() + ")" + "*" + this.getFormationBonus() + "*" + this.getCutinBonus() + "*" + this.getCutinBonus2() + "*" + this.getConditionBonus() + "+" + this.getPrecapPostMultiplyPower()
    }
    return this.getBasicPower() * this.getFormationBonus() * this.getCutinBonus() * this.getCutinBonus2() * this.getConditionBonus() + this.getPrecapPostMultiplyPower()
}

/**
 * キャップ前・乗算後の補正値を返します
 * @return {Number} 夜戦火力(キャップ前)
 */
NightBattlePower.prototype.getPrecapPostMultiplyPower = function () {
    return getOriginalGunPowerBonus(this.attacker, this.date)
}

/**
 * 夜戦火力(キャップ後)を返します
 * @param {Boolean} formulaMode 計算式モード
 * @return {[Number,Number]|String} 夜戦火力(キャップ後)
 */
NightBattlePower.prototype.getPostcapPower = function (formulaMode) {
    // A = [([キャップ後攻撃力] * 乗算特効補正 + 加算特効補正) * 乗算特効補正2 * マップ補正]
    var value = Math.floor((Math.floor(getPostcapValue(this.getPrecapPower(), this.CAP_VALUE)) * getMultiplySlayerBonus(this.attacker, this.defender) + getAddSlayerBonus(this.attacker, this.defender)) * getMultiplySlayerBonus2(this.attacker, this.defender) * getMapBonus(this.mapCell, this.attacker, this.defender))
    var str = "int((int(" + getPostcapValue(this.getPrecapPower(), this.CAP_VALUE) + ")*" + getMultiplySlayerBonus(this.attacker, this.defender) + "+" + getAddSlayerBonus(this.attacker, this.defender) + ")*" + getMultiplySlayerBonus2(this.attacker, this.defender) + "*" + getMapBonus(this.mapCell, this.attacker, this.defender) + ")"
    // クリティカル判定
    if (isCritical(this.attack)) {
        // A = [A * クリティカル補正 * 熟練度補正]
        value *= getCriticalBonus(this.attack)
        str = "(" + str + ")*" + getCriticalBonus(this.attack)
        var skilled = this.shouldUseSkilled ? getSkilledBonus(this.date, this.attack, this.attacker, this.defender, this.attackerHp) : [1.0, 1.0]
        if (formulaMode) {
            return "int((" + str + ")*" + skilled[0] + ")"
        }
        return [Math.floor(value * skilled[0]), Math.floor(value * skilled[1])]
    }
    if (formulaMode) {
        return str
    }
    return [value, value]
}

/**
 * カットイン攻撃補正を返します
 * @return {Number} 倍率
 */
NightBattlePower.prototype.getCutinBonus = function () {
    var items = Java.from(this.attack.showItem).map(function (id) { return Item.get(Number(id)) })

    switch (Number(this.attack.attackType)) {
        case 1: return 1.2  // 連撃
        case 2: return 1.3  // カットイン(主砲/魚雷)
        case 3:
            // 後期型艦首魚雷(6門)
            // 熟練聴音員+後期型艦首魚雷(6門)
            // 後期型53cm艦首魚雷(8門)
            // 21inch艦首魚雷発射管6門(後期型)
            // 潜水艦後部魚雷発射管4門(後期型)
            // 後期型艦首魚雷(4門)
            // 熟練聴音員+後期型艦首魚雷(4門)
            var lateTorpedo = [213, 214, 383, 441, 443, 457, 461]
            // 潜水艦搭載電探&水防式望遠鏡
            // 潜水艦搭載電探&逆探(E27)
            // 後期型潜水艦搭載電探&逆探
            // 後期型電探&逆探+シュノーケル装備
            var ssRadar = [210, 211, 384, 458]
            if (Java.from(this.attack.showItem).filter(function (id) { return lateTorpedo.indexOf(Number(id)) >= 0 }).length
                && Java.from(this.attack.showItem).filter(function (id) { return ssRadar.indexOf(Number(id)) >= 0 }).length) {
                return 1.75  // カットイン(後魚/潜電)
            }
            if (Java.from(this.attack.showItem).filter(function (id) { return lateTorpedo.indexOf(Number(id)) >= 0 }).length >= 2) {
                return 1.6  // カットイン(後魚/後魚)
            }
            return 1.5      // カットイン(魚雷/魚雷)
        case 4: return 1.75 // カットイン(主砲/副砲)
        case 5: return 2.0  // カットイン(主砲/主砲)
        case 6:             // 夜襲カットイン
            // 夜間戦闘機
            var kind1 = items.filter(function (item) { return item.type3 === 45 }).length
            // 夜間攻撃機
            var kind2 = items.filter(function (item) { return item.type3 === 46 }).length
            // その他(SF,岩井,彗星(31号))
            var kind3 = items.filter(function (item) { return [154, 242, 243, 244, 320].indexOf(item.id) >= 0 }).length
            if (kind1 === 2 && kind2 === 1) return 1.25
            if ((kind1 + kind2 + kind3) === 2) return 1.2
            if ((kind1 + kind2 + kind3) === 3) return 1.18
            return 1.0
        case 7:             // 駆逐カットイン(主砲/魚雷/電探) 単発
        case 11:            // 駆逐カットイン(主砲/魚雷/電探) 二発
            return 1.3
        case 8:             // 駆逐カットイン(魚雷/見張員/電探) 単発
        case 12:            // 駆逐カットイン(魚雷/見張員/電探) 二発
            // API値変化(2021/05/08～)
            if (this.date.after(getJstDate(2021, 5, 8, 18, 0, 0))) {
                return 1.2
            }
            // 魚雷
            var torpedo = items.filter(function (item) { return item.type2 === 5 }).length
            // 見張員
            var lookouts = items.filter(function (item) { return item.type2 === 39 }).length
            // 電探
            var radar = items.filter(function (item) { return item.type3 === 11 }).length
            // ドラム缶
            var drum = items.filter(function (item) { return item.type2 === 30 }).length
            if (torpedo && radar && lookouts) {
                return 1.2
            }
            if (torpedo === 2 && lookouts) {
                return 1.5
            }
            if (torpedo && lookouts && drum) {
                return 1.3
            }
            return 1
        case 9:             // 駆逐カットイン(魚雷/魚雷/見張員) 単発
        case 13:            // 駆逐カットイン(魚雷/魚雷/見張員) 二発
            return 1.5
        case 10:            // 駆逐カットイン(魚雷/ドラム缶/見張員) 単発
        case 14:            // 駆逐カットイン(魚雷/ドラム缶/見張員) 二発
            return 1.3
        default: return getSpecialAttackBonus(this)
    }
}

/**
 * カットイン攻撃補正を返します(艦これ本体の仕様に合わせるため分離)
 * @return {Number} 倍率
 */
NightBattlePower.prototype.getCutinBonus2 = function () {
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
    var items = Java.from(this.attack.showItem).map(function (id) { return Item.get(Number(id)) })

    switch (Number(this.attack.attackType)) {
        case 7:             // 駆逐カットイン(主砲/魚雷/電探) 単発
        case 11:            // 駆逐カットイン(主砲/魚雷/電探) 二発
            return modelDGunBonus
        case 8:             // 駆逐カットイン(魚雷/見張員/電探) 単発
        case 12:            // 駆逐カットイン(魚雷/見張員/電探) 二発
            // API値変化(2021/05/08～)
            if (this.date.after(getJstDate(2021, 5, 8, 18, 0, 0))) {
                return modelDGunBonus
            }
            // 魚雷
            var torpedo = items.filter(function (item) { return item.type2 === 5 }).length
            // 見張員
            var lookouts = items.filter(function (item) { return item.type2 === 39 }).length
            // 電探
            var radar = items.filter(function (item) { return item.type3 === 11 }).length
            if (torpedo && radar && lookouts) {
                return modelDGunBonus
            }
            return 1
        default: return 1
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
 * @return {0|5|7|9} 夜間触接補正
 */
NightBattlePower.prototype.getNightTouchPlaneBonus = function () {
    var touchPlane = Item.get(Number(this.touchPlane[this.attack.friendAttack ? 0 : 1]))
    if (!touchPlane) {
        return 0
    }

    if (touchPlane.param.houm <= 1) {
        return 5
    }
    if (touchPlane.param.houm === 2) {
        return 7
    }
    return 9
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
        var json = AkakariSyutsugekiLogReader.shipAfterBattle(date, attacker.id)
        if (json) {
            return JSON.parse(json.get("api_onslot"))
        }
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
        // 夜間作戦航空要員 or 夜間作戦航空要員+熟練甲板員
        return [258, 259].indexOf(itemid) >= 0
        // Saratoga Mk.II or 赤城改二戊 or 加賀改二戊 or 龍鳳改二戊
    }) || [545, 599, 610, 883].indexOf(attacker.shipId) >= 0) && items.some(function (item) {
        // 夜間戦闘機 or 夜間攻撃機
        return [45, 46].indexOf(item.type3) >= 0
        // 中破未満または装甲空母
    }) && (!attackerHp.isHalfDamage() || attacker.stype === STYPE.CVB)
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
                        // 洋上補給
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
    /** 大発動艇(II号戦車/北アフリカ仕様) */
    var pzKpfwII = getItemNum(items, 436)
    /** [カテゴリ]上陸用舟艇 */
    var daihatsuGroup = items.filter(function (item) { return item.type2 === 24 }).length
    /** [カテゴリ]上陸用舟艇[改修] */
    var daihatsuGroupLv = daihatsuGroup > 0 ? items.filter(function (item) { return item.type2 === 24 }).map(function (item) { return item.level }).reduce(function (p, c) { return p + c }, 0) / daihatsuGroup : 0
    /** 特二式内火艇 */
    var kamisha = getItemNum(items, 167)
    /** 特大発動艇+一式砲戦車 */
    var issikihou = getItemNum(items, 449)
    /** 大発動艇・特大発動艇・大発動艇(八九式中戦車&陸戦隊)・大発動艇(II号戦車/北アフリカ仕様)・特大発動艇+一式砲戦車 */
    var jpBoatA = daihatsu + tokuDaihatsu + rikuDaihatsu + pzKpfwII + issikihou
    /** 特大発動艇+戦車第11連隊・特二式内火艇 */
    var jpBoatB = shikonDaihatsu + kamisha
    /** 装甲艇(AB艇)・武装大発 */
    var spBoat = armoredBoat + armedDaihatsu
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
    
    var ship = Ship.get(attacker.shipId)
    var ctype = ship && ship.json ? (JSON.parse(ship.json).api_ctype | 0) : -1

    switch (true) {
        case isPtImpPack(defender): // PT小鬼群
            return 0.35
        case isSupplyDepotPrincess(defender): // 集積地棲姫
        case isSupplyDepotPrincessVacationModeV3(defender): // 集積地棲姫III バカンスmode
            var a = Math.pow(daihatsuGroupLv / 50 + 1, !!(rikuDaihatsu + issikihou) + !!(pzKpfwII) + 1) * (kamishaLv / 30 + 1)
            a *= (wg42 ? 1.25 : 1) * (wg42 >= 2 ? 1.3 : 1)
            a *= (type4RocketGroup ? 1.2 : 1) * (type4RocketGroup >= 2 ? 1.4 : 1)
            a *= (mortarGroup ? 1.15 : 1) * (mortarGroup >= 2 ? 1.2 : 1)
            a *= daihatsuGroup ? 1.7 : 1
            a *= tokuDaihatsu ? 1.2 : 1
            a *= ((rikuDaihatsu + issikihou) ? 1.3 : 1) * ((rikuDaihatsu + issikihou) >= 2 ? 1.6 : 1)
            a *= m4a1dd ? 1.2 : 1
            a *= (kamisha ? 1.7 : 1) * (kamisha >= 2 ? 1.5 : 1)
            a *= pzKpfwII ? 1.3 : 1
            a *= (spBoat ? 1.5 : 1) * (spBoat >= 2 ? 1.1 : 1)
            return a
        case isBattleshipSummerPrincess(defender): // 戦艦夏姫
            var a = 1
            a *= suijo ? 1.1 : 1
            a *= apShell ? 1.2 : 1
            a *= ["アークロイヤル", "ビスマルク", "プリンツ・オイゲン", "ゴトランド"].indexOf(attacker.shipInfo.flagship) >= 0 ? 1.1 : 1
            return a
        case isHeavyCrusierSummerPrincess(defender): // 重巡夏姫
            var a = 1
            a *= suijo ? 1.15 : 1
            a *= apShell ? 1.1 : 1
            a *= ["ビスマルク", "ネルソン"].indexOf(attacker.shipInfo.flagship) >= 0 ? 1.1 : 1
            return a
        case isFrenchBattleshipPrincess(defender): // 戦艦仏棲姫
            var a = 1
            a *= apShell ? 1.2 : 1
            a *= late298B ? 1.2 : 1
            a *= suijo ? 1.1 : 1
            a *= (bomber ? 1.1 : 1) * (bomber >= 2 ? 1.15 : 1)
            a *= FRENCH_SHIPS.indexOf(ctype) >= 0 ? 1.15 : 1
        case isAnchorageWaterDemonVacationMode(defender): // 泊地水鬼 バカンスmode
            var a = (daihatsuGroupLv / 50 + 1) * (kamishaLv / 30 + 1)
            a *= (bomber ? 1.4 : 1) * (bomber >= 2 ? 1.75 : 1)
            a *= (wg42 ? 1.2 : 1) * (wg42 >= 2 ? 1.3 : 1)
            a *= (type4RocketGroup ? 1.15 : 1) * (type4RocketGroup >= 2 ? 1.4 : 1)
            a *= type3shell ? 1.45 : 1
            a *= (kamisha ? 2.4 : 1) * (kamisha >= 2 ? 1.4 : 1)
            a *= daihatsuGroup ? 1.4 : 1
            a *= ((rikuDaihatsu + issikihou) ? 1.2 : 1) * ((rikuDaihatsu + issikihou) >= 2 ? 1.4 : 1)
            a *= m4a1dd ? 1.85 : 1 // 1.624~1.884
            a *= spBoat ? 1.25 : 1 // 1.187~1.279
            a *= pzKpfwII ? 1.2 : 1
            a *= ["やまと", "むさし", "ながと", "むつ"].indexOf(attacker.shipInfo.flagship) >= 0 ? 1.2 : 1
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
    switch (true) {
        case isPtImpPack(defender): // PT小鬼群
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
    /** [カテゴリ]噴式戦闘爆撃機 */
    var jetBomber = items.filter(function (item) { return item.type2 === 57 }).length
    /** [カテゴリ]水上戦闘機・水上爆撃機 */
    var suijo = items.filter(function (item) { return [11, 45].indexOf(item.type2) >= 0 }).length
    /** [カテゴリ]機銃 */
    var aaGun = items.filter(function (item) { return item.type2 === 21 }).length
    /** [カテゴリ]水上艦要員 */
    var lookouts = items.filter(function (item) { return item.type2 === 39 }).length
    /** 装甲艇(AB艇) */
    var armoredBoat = getItemNum(items, 408)
    /** 武装大発 */
    var armedDaihatsu = getItemNum(items, 409)
    /** 装甲艇(AB艇)・武装大発 */
    var spBoat = armoredBoat + armedDaihatsu
    /** max(艦上爆撃機, 噴式戦闘爆撃機) */
    var maxBomber = Math.max(bomber, jetBomber)

    switch (true) {
        case isPtImpPack(defender): // PT小鬼群
            var a = 1
            a *= (smallGun ? 1.5 : 1) * (smallGun >= 2 ? 1.4 : 1)
            a *= subGun ? 1.3 : 1
            a *= (maxBomber ? 1.4 : 1) * (maxBomber >= 2 ? 1.3 : 1)
            a *= suijo ? 1.2 : 1
            a *= (aaGun ? 1.2 : 1) * (aaGun >= 2 ? 1.2 : 1)
            a *= lookouts ? 1.1 : 1
            a *= (spBoat ? 1.2 : 1) * (spBoat >= 2 ? 1.1 : 1)
            return a
    }
    return 1.0
}

/**
 * マップ補正倍率を返す
 * @param {logbook.dto.MapCellDto} mapCell マップ
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @return {Number} 倍率
 */
var getMapBonus = function (mapCell, attacker, defender) {
    if (mapCell.map[0] === 7 && mapCell.map[1] === 4) {
        // Jマス、Lマス
        if ([10, 18, 12, 20].indexOf(mapCell.map[2]) >= 0) {
            switch (attacker.stype) {
                // 海防艦
                case STYPE.DE: return 1.25
                // 練習巡洋艦
                case STYPE.CT: return 1.15
            }
        }
        if (mapCell.isBoss()) {
            switch (attacker.stype) {
                // 海防艦
                case STYPE.DE: return 1.33
                // 練習巡洋艦
                case STYPE.CT: return 1.23
            }
        }
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
    return [
        1815, 1816, 1817,
        1818, 1819, 1820
    ].indexOf(ship.shipId) >= 0
}

/**
 * 集積地棲姫か
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 */
var isSupplyDepotPrincess = function (ship) {
    return [
        1653, 1654, 1655,       // 集積地棲姫
        1656, 1657, 1658,       // 集積地棲姫-壊
        1809, 1810, 1811,       // 集積地棲姫 バカンスmode
        1812, 1813, 1814,       // 集積地棲姫 バカンスmode-壊
        1921, 1922, 1923,       // 集積地棲姫II
        1924, 1925, 1926,       // 集積地棲姫II-壊
        1933, 1934, 1935,       // 集積地棲姫II 夏季上陸mode
        1936, 1937, 1938,       // 集積地棲姫II 夏季上陸mode-壊
        1994,                   // 集積地棲姫II
        1995,                   // 集積地棲姫II-壊
        2015, 2016, 2017, 2018, // 集積地棲姫II バカンスmode
        2019, 2020, 2021, 2022, // 集積地棲姫II バカンスmode-壊
        2084, 2086, 2088,       // 集積地棲姫III
        2085, 2087, 2089,       // 集積地棲姫III-壊
    ].indexOf(ship.shipId) >= 0
}

/**
 * 集積地棲姫III バカンスmodeか
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 */
var isSupplyDepotPrincessVacationModeV3 = function (ship) {
    return [
        2138, 2140, 2142, 2144, // 集積地棲姫III バカンスmode
        2139, 2141, 2143, 2145, // 集積地棲姫III バカンスmode-壊
    ].indexOf(ship.shipId) >= 0
}

/**
 * 港湾夏姫か
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 */
var isHarbourSummerPrincess = function (ship) {
    return [
        1699, 1700, 1701,   // 港湾夏姫
        1702, 1703, 1704,   // 港湾夏姫-壊
        2023, 2024, 2025,   // 港湾夏姫II
        2026, 2027, 2028,   // 港湾夏姫II-壊
    ].indexOf(ship.shipId) >= 0
}

/**
 * 戦艦夏姫か
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 */
var isBattleshipSummerPrincess = function (ship) {
    return [1696, 1697, 1698].indexOf(ship.shipId) >= 0
}

/**
 * 重巡夏姫か
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 */
var isHeavyCrusierSummerPrincess = function (ship) {
    return [1705, 1706, 1707].indexOf(ship.shipId) >= 0
}

/**
 * 戦艦仏棲姫か
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 */
var isFrenchBattleshipPrincess = function (ship) {
    return [
        1745, 1746, 1747,   // 戦艦仏棲姫
        1748, 1749, 1750,   // 戦艦仏棲姫-壊
        1834, 1835, 1836,   // 戦艦仏棲姫 バカンスmode
        1837, 1838, 1839,   // 戦艦仏棲姫-壊 バカンスmode
    ].indexOf(ship.shipId) >= 0
}

/**
 * 砲台小鬼か
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 */
var isArtilleryImp = function (ship) {
    return [1665, 1666, 1667].indexOf(ship.shipId) >= 0
}

/**
 * 離島棲姫か
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 */
var isIsolatedIslandPrincess = function (ship) {
    return [1668, 1669, 1670, 1671, 1672].indexOf(ship.shipId) >= 0
}

/**
 * 陸上特効補正を返します
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {boolean} isDay 昼戦か
 * @return {{stypeBonus:{a:Number, b:Number}, basicBonus: {a:Number, b:Number}, shikonBonus: {a:Number, b:Number}, m4a1ddBonus: {a:Number, b:Number}, issikihouBonus: {a:Number, b:Number}, supportBonus: {a:Number, b:Number}}} 補正値
 */
var getLandBonus = function (attacker, defender, isDay) {
    if (!isGround(defender) && !isAnchorageWaterDemonVacationMode(defender) || isNorthernmostLandingPrincess(defender)) {
        return {
            stypeBonus: {a: 1, b: 0},
            basicBonus: {a: 1, b: 0},
            shikonBonus: {a: 1, b: 0},
            m4a1ddBonus: {a: 1, b: 0},
            issikihouBonus: {a: 1, b: 0},
            supportBonus: {a: 1, b: 0}
        }
    }
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
    /** 大発動艇(II号戦車/北アフリカ仕様) */
    var pzKpfwII = getItemNum(items, 436)
    /** [カテゴリ]上陸用舟艇 */
    var daihatsuGroup = items.filter(function (item) { return item.type2 === 24 }).length
    /** [カテゴリ]上陸用舟艇[改修] */
    var daihatsuGroupLv = daihatsuGroup > 0 ? items.filter(function (item) { return item.type2 === 24 }).map(function (item) { return item.level }).reduce(function (p, c) { return p + c }, 0) / daihatsuGroup : 0
    /** 特二式内火艇 */
    var kamisha = getItemNum(items, 167)
    /** 特大発動艇+一式砲戦車 */
    var issikihou = getItemNum(items, 449)
    /** 大発動艇・特大発動艇・大発動艇(八九式中戦車&陸戦隊)・大発動艇(II号戦車/北アフリカ仕様)・特大発動艇+一式砲戦車 */
    var jpBoatA = daihatsu + tokuDaihatsu + rikuDaihatsu + pzKpfwII + issikihou
    /** 特大発動艇+戦車第11連隊・特二式内火艇 */
    var jpBoatB = shikonDaihatsu + kamisha
    /** 装甲艇(AB艇)・武装大発 */
    var spBoat = armoredBoat + armedDaihatsu
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

    var a = (daihatsuGroupLv / 50 + 1) * (kamishaLv / 30 + 1)
    var b = ([0, 75, 110, 140, 160, 160])[wg42]
        + ([0, 30, 55, 75, 90, 90])[type2Mortar]
        + ([0, 60, 110, 150, 180, 180])[type2MortarEx]
        + ([0, 55, 115, 160, 190, 190])[type4Rocket]
        + ([0, 80, 170, 230, 260, 260])[type4RocketEx]

    switch (true) {
        case isArtilleryImp(defender): // 砲台小鬼
            a *= apShell ? 1.85 : 1
            a *= (wg42 ? 1.6 : 1) * (wg42 >= 2 ? 1.7 : 1)
            a *= (type4RocketGroup ? 1.5 : 1) * (type4RocketGroup >= 2 ? 1.8 : 1)
            a *= (mortarGroup ? 1.3 : 1) * (mortarGroup >= 2 ? 1.5 : 1)
            a *= suijo ? 1.5 : 1
            a *= (bomber ? 1.5 : 1) * (bomber >= 2 ? 2.0 : 1)
            a *= daihatsuGroup ? 1.8 : 1
            a *= tokuDaihatsu ? 1.15 : 1
            a *= ((rikuDaihatsu + issikihou) ? 1.5 : 1) * ((rikuDaihatsu + issikihou) >= 2 ? 1.4 : 1)
            a *= m4a1dd ? 2.0 : 1
            a *= (kamisha ? 2.4 : 1) * (kamisha >= 2 ? 1.35 : 1)
            if (isDay) {
                a *= (spBoat ? 1.3 : 1) * (spBoat >= 2 ? 1.2 : 1)
            }
            break
        case isIsolatedIslandPrincess(defender): // 離島棲姫
            a *= type3shell ? 1.75 : 1
            a *= (wg42 ? 1.4 : 1) * (wg42 >= 2 ? 1.5 : 1)
            a *= (type4RocketGroup ? 1.3 : 1) * (type4RocketGroup >= 2 ? 1.65 : 1)
            a *= (mortarGroup ? 1.2 : 1) * (mortarGroup >= 2 ? 1.4 : 1)
            a *= (bomber ? 1.4 : 1) * (bomber >= 2 ? 1.75 : 1)
            a *= daihatsuGroup ? 1.8 : 1
            a *= tokuDaihatsu ? 1.15 : 1
            a *= ((rikuDaihatsu + issikihou) ? 1.2 : 1) * ((rikuDaihatsu + issikihou) >= 2 ? 1.4 : 1)
            a *= m4a1dd ? 1.8 : 1
            a *= (kamisha ? 2.4 : 1) * (kamisha >= 2 ? 1.35 : 1)
            if (isDay) {
                a *= (spBoat ? 1.3 : 1) * (spBoat >= 2 ? 1.1 : 1)
            }
            break
        case isHarbourSummerPrincess(defender): // 港湾夏姫
            a *= type3shell ? 1.75 : 1
            a *= apShell ? 1.3 : 1
            a *= (wg42 ? 1.4 : 1) * (wg42 >= 2 ? 1.2 : 1)
            a *= (type4RocketGroup ? 1.25 : 1) * (type4RocketGroup >= 2 ? 1.4 : 1)
            a *= (mortarGroup ? 1.1 : 1) * (mortarGroup >= 2 ? 1.15 : 1)
            a *= suijo ? 1.3 : 1
            a *= (bomber ? 1.3 : 1) * (bomber >= 2 ? 1.2 : 1)
            a *= daihatsuGroup ? 1.7 : 1
            a *= tokuDaihatsu ? 1.2 : 1
            a *= ((rikuDaihatsu + issikihou) ? 1.6 : 1) * ((rikuDaihatsu + issikihou) >= 2 ? 1.5 : 1)
            a *= m4a1dd ? 2.0 : 1
            a *= kamisha ? 2.8 : 1
            if (isDay) {
                a *= (spBoat ? 1.5 : 1) * (spBoat >= 2 ? 1.1 : 1)
            }
            break
        default: // ソフトスキン
            a *= type3shell ? 2.5 : 1
            a *= (wg42 ? 1.3 : 1) * (wg42 >= 2 ? 1.4 : 1)
            a *= (type4RocketGroup ? 1.25 : 1) * (type4RocketGroup >= 2 ? 1.5 : 1)
            a *= (mortarGroup ? 1.2 : 1) * (mortarGroup >= 2 ? 1.3 : 1)
            a *= suijo ? 1.2 : 1
            a *= daihatsuGroup ? 1.4 : 1
            a *= tokuDaihatsu ? 1.15 : 1
            a *= ((rikuDaihatsu + issikihou) ? 1.5 : 1) * ((rikuDaihatsu + issikihou) >= 2 ? 1.3 : 1)
            a *= m4a1dd ? 1.1 : 1
            a *= (kamisha ? 1.5 : 1) * (kamisha >= 2 ? 1.2 : 1)
            a *= pzKpfwII ? 1.5 : 1
            if (isDay) {
                a *= (spBoat ? 1.1 : 1) * (spBoat >= 2 ? 1.1 : 1)
            }
            break
    }

    return {
        /** 艦種補正 */
        stypeBonus: (function () {
            // 潜水艦
            var b = isSubMarine(attacker) ? 30 : 0
            // 砲台小鬼
            if ([1665, 1666, 1667].indexOf(defender.shipId) >= 0) {
                // 駆逐艦、軽巡洋艦
                if ([STYPE.DD, STYPE.CL].indexOf(attacker.stype) >= 0) {
                    return { a: 1.4, b: b }
                }
            }
            return { a: 1, b: b }
        })(),
        /** 基本補正 */
        basicBonus: { a: a, b: b },
        /** 特大発動艇+戦車第11連隊 */
        shikonBonus: (shikonDaihatsu + issikihou) ? { a: 1.8, b: 25 } : { a: 1, b: 0 },
        /** M4A1DD */
        m4a1ddBonus: m4a1dd ? { a: 1.4, b: 35 } : { a: 1, b: 0 },
        /** 特大発動艇+一式砲戦車 */
        issikihouBonus: issikihou ? { a: 1.3, b: 42 } : { a: 1, b: 0 },
        /** 支援上陸用舟艇シナジー */
        supportBonus: (function () {
            // 武装大発だけ2枠以上、または装甲艇(AB艇)だけ2枠以上の場合このシナジーは発生しない
            if (armedDaihatsu >= 2 || armoredBoat >= 2) {
                return { a: 1, b: 0 }
            }
            if (spBoat === 1 && (jpBoatA + jpBoatB)) {
                return { a: 1.2, b: 10 }
            }
            if (spBoat >= 2) {
                if ((jpBoatA + jpBoatB) >= 2) {
                    return { a: 1.2 * 1.3, b: 15 }
                }
                if (jpBoatA) {
                    return { a: 1.2 * 1.1, b: 12 }
                }
                if (jpBoatB) {
                    return { a: 1.2 * 1.2, b: 13 }
                }
            }
            return { a: 1, b: 0 }
        })(),
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
        && !([STYPE.CV, STYPE.CVB, STYPE.AO].indexOf(attacker.stype) >= 0 && isSubMarine(defender))) {
        var items = Java.from(attacker.item2.toArray())
        // 戦爆連合CI(熟練度は2017/10/18以降から)
        if (!attack.kind.isNight() && Number(attack.attackType) === 7 && date.after(ADD_SKILLED_DATE)) {
            var onSlot = getOnSlot(attacker, date)
            var exps = items.filter(function (item, i) {
                return item !== null && isSkilledObject(item) && onSlot[i] > 0
            }).reduce(function (p, item) {
                return [p[0] + SKILLED[item.alv].INTERNAL[0], p[1] + SKILLED[item.alv].INTERNAL[1], p[2] + 1]
            }, [0, 0, 0])
            var avgExps = [Math.floor(exps[0] / exps[2]), Math.floor(exps[1] / exps[2])]
            // ちゃんと区別出来ないが、slotitemIdでしか区別出来ないため
            if (items[0] !== null && Java.from(attack.showItem).some(function (slotitemId) { return Number(slotitemId) === items[0].slotitemId })) {
                // 隊長機あり
                var modifier = function (captainExp, avgExp) {
                    if (captainExp >= 100) {
                        return 1 + captainExp * 0.003 + avgExp * 0.001 - 0.23
                    } else {
                        return 1 + captainExp * 0.0006 + 0.024
                    }
                }
                result[0] = modifier(SKILLED[items[0].alv].INTERNAL[0], avgExps[0])
                result[1] = modifier(SKILLED[items[0].alv].INTERNAL[1], avgExps[1])
            } else {
                // 隊長機なし
                var modifier = function (exp) {
                    if (exp >= 119) {
                        return 1.066 + 0.04
                    } else if (exp >= 107) {
                        return 1.066 + 0.03
                    } else if (exp >= 50) {
                        return 1.0 + (exp - 50.0) / 1000.0
                    } else {
                        return 1.0
                    }
                }
                result[0] = modifier(avgExps[0])
                result[1] = modifier(avgExps[1])
            }
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
 * @param {java.util.Date} date 戦闘日時
 * @return {Boolean} 特殊砲補正
 */
var getOriginalGunPowerBonus = function (ship, date) {
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
    // 軽巡洋艦、重雷装巡洋艦、練習巡洋艦
    if ([STYPE.CL, STYPE.CLT, STYPE.CT].indexOf(ship.stype) >= 0) {
        var twinGunBonus = Math.sqrt(ids.filter(function (id) { return twinGuns.indexOf(id) >= 0 }).length) * 2
        var singleGunBonus = Math.sqrt(ids.filter(function (id) { return singleGuns.indexOf(id) >= 0 }).length)
        bonus += twinGunBonus + singleGunBonus
    }
    // 伊重巡フィット砲補正
    switch (ship.shipId) {
        case 448: // Zara
        case 358: // Zara改
        case 496: // Zara due
        case 449: // Pola
        case 361: // Pola改
            // 203mm/53 連装砲
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
    if (isSubMarine(defender) && date.before(MYSTERY_FIXED_DATE)) {
        // 九六式艦戦改
        var has96FighterKai = getItems(attacker).some(function (item) { return item.slotitemId === 228 })
        if (has96FighterKai) {
            return Number.NEGATIVE_INFINITY
        }
    }

    var mediumBulge = getItems(defender).filter(function (item) { return item.type2 === 27 }).map(function (item) { return 0.2 * item.level }).reduce(function (p, c) { return p + c }, 0)
    var largeBulge = getItems(defender).filter(function (item) { return item.type2 === 28 }).map(function (item) { return 0.3 * item.level }).reduce(function (p, c) { return p + c }, 0)
    var depthCharge = isSubMarine(defender) ? getItems(attacker).map(function (item) {
        // 九五式爆雷
        // 二式爆雷
        // 対潜短魚雷(試作初期型)
        // RUR-4A Weapon Alpha改
        // Hedgehog(初期型)
        // Mk.32 対潜魚雷(Mk.2落射機)
        var targetItems = date.after(getJstDate(2022, 8, 4, 12, 0, 0)) ? [226, 227, 377, 378, 439, 472] : [226, 227]
        if (targetItems.indexOf(item.slotitemId) >= 0) {
            return Math.sqrt(item.param.taisen - 2) + (attacker.stype === 1 ? 1 : 0)
        }
        return 0
    }).reduce(function (p, c) { return p + c }, 0) : 0
    // 北方迷彩(+北方装備)
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
    var UPDATE_SPECIAL_ATTACK_BONUS_DATE2 = getJstDate(2022, 6, 8, 12, 0, 0)
    var ships = that.origins[that.attack.mainAttack ? "main" : "escort"]
    var attackIndex = that.attack.attackIndex
    var engagement = that.formation[2]

    switch (Number(that.attack.attackType)) {
        case 100: // Nelson Touch
            return 2.0 * (engagement === 4 ? 1.25 : 1.0)
        case 101: // 一斉射かッ…胸が熱いな！
            var base = attackIndex < 2 ? 1.4 : 1.2
            var secondShipBonus = function(date, secondShipId) {
                if (attackIndex < 2) {
                    switch (secondShipId) {
                        case 573: return 1.2  // 陸奥改二
                        case 276: return 1.15 // 陸奥改
                        case 576: return date.after(UPDATE_SPECIAL_ATTACK_BONUS_DATE) ? 1.1 : 1.0  // Nelson改
                    }
                } else {
                    switch (secondShipId) {
                        case 573: return 1.4  // 陸奥改二
                        case 276: return 1.35 // 陸奥改
                        case 576: return date.after(UPDATE_SPECIAL_ATTACK_BONUS_DATE) ? 1.25 : 1.0  // Nelson改
                    }
                }
                return 1.0
            }(that.date, ships[1].shipId)
            var itemBonus = function(date, items) {
                if (date.before(ADD_ITEM_BONUS_DATE)) return 1
                var surfaceRadarBonus = hasSurfaceRadar(items) ? 1.15 : 1
                var apShellBonus = hasAPShell(items) ? 1.35 : 1
                return surfaceRadarBonus * apShellBonus
            }(that.date, attackIndex < 2 ? that.items : getItems(ships[1]))
            return base * secondShipBonus * itemBonus
        case 102: // 長門、いい？ いくわよ！ 主砲一斉射ッ！
            var base = attackIndex < 2 ? 1.4 : 1.2
            var secondShipBonus = function(secondShipId) {
                if (attackIndex < 2) {
                    // 長門改/長門改二
                    if ([275, 541].indexOf(secondShipId) >= 0) {
                        return 1.2
                    }
                } else {
                    // 長門改/長門改二
                    if ([275, 541].indexOf(secondShipId) >= 0) {
                        return 1.4
                    }
                }
                return 1.0
            }(ships[1].shipId)
            var itemBonus = function(items) {
                var surfaceRadarBonus = hasSurfaceRadar(items) ? 1.15 : 1
                var apShellBonus = hasAPShell(items) ? 1.35 : 1
                return surfaceRadarBonus * apShellBonus
            }(attackIndex < 2 ? that.items : getItems(ships[1]))
            return base * secondShipBonus * itemBonus
        case 103: // Colorado 特殊攻撃 ※正式名称不明
            var base = that.date.after(UPDATE_SPECIAL_ATTACK_BONUS_DATE2) ?
                (attackIndex === 0 ? 1.5 : 1.3) : (attackIndex === 0 ? 1.3 : 1.15)
            var companionShipBonus = function(secondShipId, thirdShipId) {
                if (that.date.after(UPDATE_SPECIAL_ATTACK_BONUS_DATE2)) {
                    switch (attackIndex) {
                        case 1:
                            return isBig7BonusShipId(secondShipId) ? 1.15 : 1
                        case 2:
                            return isBig7BonusShipId(thirdShipId) ? 1.17 : 1
                    }
                } else if (that.date.after(UPDATE_SPECIAL_ATTACK_BONUS_DATE)) {
                    switch (attackIndex) {
                        case 1:
                            return isBig7BonusShipId(secondShipId) ? 1.1 : 1
                        case 2:
                            return isBig7BonusShipId(thirdShipId) ? 1.15 : 1
                    }
                } else {
                    // bug
                    switch (attackIndex) {
                        case 1:
                            return isBig7BonusShipId(secondShipId) ? 1.1 : 1
                        case 2:
                            return isBig7BonusShipId(thirdShipId) ? 1.15 * (isBig7BonusShipId(secondShipId) ? 1.1 : 1) : 1
                    }
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
                var sgRadarBonus = function(items) {
                    return that.date.after(UPDATE_SPECIAL_ATTACK_BONUS_DATE2) && hasSgRadarLateModel(items) ? 1.15 : 1
                }
                switch (attackIndex) {
                    case 0: return surfaceRadarBonus(items) * apShellBonus(items) * sgRadarBonus(items)
                    case 1:
                        var secondShipItems = getItems(ships[1])
                        return surfaceRadarBonus(secondShipItems) * apShellBonus(secondShipItems) * sgRadarBonus(secondShipItems)
                    case 2:
                        var thirdShipItems = getItems(ships[2])
                        // 艦これ負の遺産
                        if (that.date.before(getJstDate(2021, 10, 15, 12, 0, 0))) {
                            var secondShipItems = getItems(ships[1])
                            if (isBig7BonusShipId(thirdShipId)) {
                                if (isBig7BonusShipId(secondShipId) || surfaceRadarBonus(secondShipItems) * apShellBonus(secondShipItems) > 1) {
                                    return surfaceRadarBonus(secondShipItems) * apShellBonus(secondShipItems)
                                }
                                return surfaceRadarBonus(thirdShipItems) * apShellBonus(thirdShipItems) * sgRadarBonus(thirdShipItems)
                            }
                            if (ships[1].item2.size() === 5) {
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
                            return 1
                        }
                        return surfaceRadarBonus(thirdShipItems) * apShellBonus(thirdShipItems) * sgRadarBonus(thirdShipItems)
                }
                return 1
            }(that.items, ships[1].shipInfo.flagship, ships[2].shipInfo.flagship)
            return base * companionShipBonus * itemBonus
        case 104: // 僚艦夜戦突撃
            var base = that.date.after(UPDATE_SPECIAL_ATTACK_BONUS_DATE2) ? 2.2 : 1.9
            var engagementBonus = function() {
                switch (engagement) {
                    case 3: return 1.25
                    case 4: return 0.75
                }
                return 1.0
            }()
            return base * engagementBonus
        case 200: return 1.35 // 瑞雲立体攻撃
        case 201: return 1.3 // 海空立体攻撃
        case 400: // 大和 特殊攻撃(3隻版) ※正式名称不明
            var base = attackIndex < 2 ? 1.5 : 1.65
            // 最終改造形態じゃないと発動しないらしい
            var secondShipCtype = JSON.parse(Ship.get(ships[1].shipId).json).api_ctype | 0
            var thirdShipCtype = JSON.parse(Ship.get(ships[2].shipId).json).api_ctype | 0
            var companionCtypes = [secondShipCtype, thirdShipCtype]
            var companionShipBonus = function(ctypes) {
                switch (attackIndex) {
                    case 0:
                        // 大和型、長門型、伊勢型
                        if (ctypes.indexOf(37) >= 0 || ctypes.indexOf(19) >= 0 || ctypes.indexOf(2) >= 0) {
                            return 1.1
                        }
                        break
                    case 1:
                        // 大和型
                        if (ctypes.indexOf(37) >= 0) {
                            return 1.2
                        }
                        // 長門型
                        if (ctypes.indexOf(19) >= 0) {
                            return 1.1
                        }
                        // 伊勢型
                        if (ctypes.indexOf(2) >= 0) {
                            return 1.05
                        }
                        break
                }
                return 1.0
            }(companionCtypes)
            var itemBonus = function(items) {
                var surfaceRadarBonus = function(items) {
                    return hasSurfaceRadar(items) ? 1.15 : 1
                }
                var apShellBonus = function(items) {
                    return hasAPShell(items) ? 1.35 : 1
                }
                var yamatoClassRadarBonus = function(items) {
                    return hasYamatoClassRadar(items) ? 1.1 : 1
                }
                switch (attackIndex) {
                    case 0: return surfaceRadarBonus(items) * apShellBonus(items) * yamatoClassRadarBonus(items)
                    case 1:
                        var secondShipItems = getItems(ships[1])
                        return surfaceRadarBonus(secondShipItems) * apShellBonus(secondShipItems) * yamatoClassRadarBonus(secondShipItems)
                    case 2:
                        // 艦これ負の遺産
                        // https://twitter.com/KanColle_STAFF/status/1534778149887950848
                        if (that.date.before(getJstDate(2022, 6, 9, 15, 3, 0))) {
                            var secondShipItems = getItems(ships[1])
                            return surfaceRadarBonus(secondShipItems) * apShellBonus(secondShipItems) * yamatoClassRadarBonus(secondShipItems)
                        }
                        // 正しい方
                        var thirdShipItems = getItems(ships[2])
                        return surfaceRadarBonus(thirdShipItems) * apShellBonus(thirdShipItems)
                }
                return 1
            }(that.items)
            return base * companionShipBonus * itemBonus
        case 401: // 大和 特殊攻撃(2隻版) ※正式名称不明
            var base = attackIndex < 2 ? 1.4 : 1.55
            var secondShipBonus = function(secondShipId) {
                if (attackIndex < 2) {
                    // 大和型改二
                    if ([546, 911, 916].indexOf(secondShipId) >= 0) {
                        return 1.1
                    }
                } else {
                    if (secondShipId === 916) {
                        // 大和改二重
                        return 1.25
                    } else if ([546, 911].indexOf(secondShipId) >= 0) {
                        // 大和改二・武蔵改二
                        return 1.2
                    }
                }
                return 1.0
            }(ships[1].shipId)
            var itemBonus = function(items) {
                var surfaceRadarBonus = hasSurfaceRadar(items) ? 1.15 : 1
                var apShellBonus = hasAPShell(items) ? 1.35 : 1
                var yamatoClassRadarBonus = hasYamatoClassRadar(items) ? 1.1 : 1
                return surfaceRadarBonus * apShellBonus * yamatoClassRadarBonus
            }(attackIndex < 2 ? that.items : getItems(ships[1]))
            return base * secondShipBonus * itemBonus
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
 * @return {InvolvedShipsDto} 攻撃艦/防御艦
 */
var extractInvolvedShips = function (attack, friends, enemies) {
    var attacker = (attack.friendAttack ? friends : enemies)[attack.mainAttack ? "main" : "escort"].get(attack.attacker % Math.max(6, (attack.friendAttack ? friends : enemies).main.length))
    var defender = (!attack.friendAttack ? friends : enemies)[attack.mainDefense ? "main" : "escort"].get(attack.defender % Math.max(6, (!attack.friendAttack ? friends : enemies).main.length))
    return new InvolvedShipsDto(attacker, defender)
}

/**
 * 攻撃側/防御側Hpを返す
 * @param {AttackDto} attack
 * @param {FleetHpDto} friendHp
 * @param {FleetHpDto} enemyHp
 * @return {InvolvedShipHpsDto} 攻撃艦/防御艦Hp
 */
var extractInvolvedShipHps = function (attack, friendHp, enemyHp) {
    var attackerHp = (attack.friendAttack ? friendHp : enemyHp)[attack.mainAttack ? "main" : "escort"][attack.attacker % Math.max(6, (attack.friendAttack ? friendHp : enemyHp).main.length)]
    var defenderHp = (!attack.friendAttack ? friendHp : enemyHp)[attack.mainDefense ? "main" : "escort"][attack.defender % Math.max(6, (!attack.friendAttack ? friendHp : enemyHp).main.length)]
    return new InvolvedShipHpsDto(attackerHp, defenderHp)
}

/**
 * ダメージ処理及びダメコン処理を行う
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦
 * @param {ShipHpDto} shipHp 艦Hp
 * @param {Number} damage ダメージ
 * @param {Boolean} useDamageControl ダメコン処理をするか(デフォルト=true)
 */
var damageHandling = function (ship, shipHp, damage, useDamageControl) {
    shipHp.now -= Math.floor(damage)
    if (useDamageControl === undefined || useDamageControl) {
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
        if (date.after(ADD_TRANSPORTATION_FORCE_DATE)) return 3
    }
    // 不明
    return -1
}

/**
 * ビック7補正がかかるかを返す
 * @param {Number} shipId 艦ID
 * @return {Boolean} ビック7か
 */
function isBig7BonusShipId(shipId) {
    return [
        275,  // 長門改
        541,  // 長門改二
        276,  // 陸奥改
        573,  // 陸奥改二
        576,  // Nelson改
        601,  // Colorado
        1496, // Colorado改
        913,  // Maryland
        918,  // Maryland改
    ].indexOf(shipId) >= 0
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
 * 大和型電探を所持しているかを返す
 * @param {[logbook.dto.ItemDto]} items 装備
 * @return {Boolean} 所持の有無
 */
function hasYamatoClassRadar(items) {
    // 15m二重測距儀+21号電探改二、15m二重測距儀改+21号電探改二+熟練射撃指揮所
    return items.some(function(item) { return [142, 460].indexOf(item.slotitemId) >= 0 })
}

/**
 * SG レーダー(後期型)を所持しているかを返す
 * @param {[logbook.dto.ItemDto]} items 装備
 * @return {Boolean} 所持の有無
 */
function hasSgRadarLateModel(items) {
    // SG レーダー(後期型)
    return items.some(function(item) { return item.slotitemId === 456 })
}

/**
 * 素火力を返す
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.ShipDto} attacker 攻撃艦
 * @return {Number}
 */
function getRawFirePower(date, attacker) {
    return attacker.karyoku - getSlotParam(attacker).karyoku - getEquipmentBonus(date, attacker).fp
}

/**
 * 装備合計パラメータを返す
 * @param {logbook.dto.ShipDto} attacker 攻撃艦
 * @return {logbook.dto.ShipParameters}
 */
function getSlotParam(attacker) {
    return getItems(attacker).map(function (item) {
        return item.param
    }).reduce(function (p, param) {
        p.add(param)
        return p
    }, new ShipParameters())
}

/**
 * 装備ボーナスの値を返す
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @return {{fp: number, asw: number, tp: number, bomb: number}}
 */
function getEquipmentBonus(date, attacker) {
    var shipId = attacker.shipId
    var stype = attacker.stype
    var ctype = (JSON.parse(Ship.get(attacker.shipId).json).api_ctype | 0)
    var yomi = attacker.shipInfo.flagship
    var items = getItems(attacker)
    var bonus = { fp: 0, asw: 0, tp: 0, bomb: 0 }
    function add(effect, num, max) {
        // 火力・対潜・爆装
        ["fp", "asw", "bomb"].forEach(function(param) {
            bonus[param] += (effect[param] | 0) * Math.min(num, max | 0 || Infinity)
        })
        // 雷装
        if (num > 0 && effect.tp) {
            bonus.tp = Math.min(bonus.tp || Infinity, effect.tp)
        }
    }
    var itemNums = items.reduce(function(previous, item) {
        previous[item.slotitemId] = (previous[item.slotitemId] | 0) + 1
        return previous
    }, {})
    function count(slotitemId) {
        return itemNums[slotitemId] | 0
    }
    var num = 0

    // 艦上偵察機
    if (items.some(function(item) { return item.type2 === 9 })) {
        var max = items.filter(function(item) {
            return item.type2 === 9
        }).reduce(function(previous, item){
            return previous > item.level ? previous : item.level
        }, 0)
        // 正規空母、軽空母、装甲空母、航空戦艦
        if ([STYPE.CV, STYPE.CVB, STYPE.CVL, STYPE.BBV].indexOf(stype) >= 0) {
            var fp = 0
            if (max >= 4) fp++
            if (max >= 10) fp++
            add({ fp: fp }, 1)
        }
    }
    // 水上偵察機
    if (items.some(function(item) { return item.type2 === 10 })) {
        // 能代改二、矢矧改二、矢矧改二乙
        if ([662, 663, 668].indexOf(shipId) >= 0) {
            add({ asw: 3 }, 1)
        }
    }
    // 水上爆撃機
    if (items.some(function(item) { return item.type2 === 11 })) {
        // 能代改二、矢矧改二、矢矧改二乙
        if ([662, 663, 668].indexOf(shipId) >= 0) {
            add({ asw: 1 }, 1)
        }
    }
    // 電探
    // if (items.some(function(item) { return [12, 13].indexOf(item.type2) >= 0 })) {}
    // オートジャイロ
    if (items.some(function(item) { return item.type2 === 25 })) {
        // 能代改二
        if (shipId === 662) {
            add({ asw: 4 }, 1)
        }
        // 矢矧改二、矢矧改二乙
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
    // if (num = count(3) + count(122)) {}
    // 15.5cm三連装砲
    // if (num = count(5)) {}
    // 15.5cm三連装副砲
    // if (num = count(12)) {}
    // 61cm四連装(酸素)魚雷
    // if (num = count(15)) {}
    // 流星
    // 流星改
    if (num = count(18) + count(52)) {
        if (date.after(getJstDate(2019, 5, 20, 12, 0, 0))) {
            if ([277, 278, 156].indexOf(shipId) >= 0) {
                // 赤城改、加賀改、大鳳改
                add({ fp: 1 }, num)
            } else if ([594, 698, 646].indexOf(shipId) >= 0) {
                // 赤城改二、加賀改二、加賀改二護
                add({ fp: 1 }, num)
            } else if ([599, 610].indexOf(shipId) >= 0) {
                // 赤城改二戊、加賀改二戊
                add({ fp: 2 }, num)
            }
        }
    }
    // 九六式艦戦
    if (num = count(19)) {
        if (date.after(getJstDate(2020, 3, 27, 12, 0, 0))) {
            if (yomi === "ほうしょう") {
                add({ fp: 2, asw: 2 }, num)
            }
            // 春日丸級、大鷹型
            if ([75, 76].indexOf(ctype) >= 0) {
                add({ fp: 2, asw: 3 }, num)
            }
        } else if (date.after(getJstDate(2019, 8, 8, 12, 0, 0))) {
            if (yomi === "ほうしょう") {
                add({ fp: 1, asw: 1 }, num)
            }
            // 春日丸級、大鷹型
            if ([75, 76].indexOf(ctype) >= 0) {
                add({ fp: 1, asw: 2 }, num)
            }
        }
    }
    // 彗星
    // 彗星一二型甲
    // 彗星(六〇一空)
    // if (num = count(24) + count(57) + count(111)) {}
    // 瑞雲
    // 試製晴嵐
    // 瑞雲(六三四空)
    // 瑞雲12型
    // 瑞雲12型(六三四空)
    // 瑞雲(六三一空)
    // 晴嵐(六三一空)
    // if (num = count(26) + count(62) + count(79) + count(80) + count(81) + count(207) + count(208)) {}
    // 三式弾
    // if (num = count(35)) {}
    // 25mm連装機銃
    // 25mm三連装機銃
    // 25mm単装機銃
    // 25mm三連装機銃 集中配備
    // if (num = count(39) + count(40) + count(49) + count(131)) {}
    // 21号対空電探
    // 21号対空電探改二
    // if (num = count(30) + count(410)) {}
    // 九四式爆雷投射機
    // 三式爆雷投射機
    // 三式爆雷投射機 集中配備
    // 試製15cm9連装対潜噴進砲
    if (num = count(44) + count(45) + count(287) + count(288)) {
        if (date.after(getJstDate(2021, 3, 1, 12, 0, 0))) {
            // 香取型
            if (ctype === 56) {
                add({ asw: 3 }, num)
            }
        }
    }
    // 九三式水中聴音機
    // 三式水中探信儀
    // 四式水中聴音機
    // 零式水中聴音機
    // 三式水中探信儀改
    if (num = count(46) + count(47) + count(149) + count(132) + count(438)) {
        if (date.after(getJstDate(2021, 3, 1, 12, 0, 0))) {
            // 香取型
            if (ctype === 56) {
                add({ asw: 2 }, num, 1)
            }
        }
    }
    // 三式水中探信儀
    // 三式水中探信儀改
    if (num = count(47) + count(438)) {
        if (date.after(getJstDate(2019, 1, 22, 12, 0, 0))) {
            if (["あさしも", "はるかぜ", "かみかぜ", "やまかぜ", "まいかぜ", "しぐれ"].indexOf(yomi) >= 0) {
                add({ asw: 3 }, num)
            } else if (["きしなみ", "いそかぜ", "はまかぜ", "うしお", "いかづち", "やまぐも"].indexOf(yomi) >= 0) {
                add({ asw: 2 }, num)
            }
        }
    }
    // 20.3cm(3号)連装砲
    // if (num = count(50)) {}
    // 61cm五連装(酸素)魚雷
    // if (num = count(58)) {}
    // 零式水上観測機
    // if (num = count(59)) {}
    // 零式艦戦62型(爆戦)
    // 零戦62型(爆戦/岩井隊)
    // 零式艦戦63型(爆戦)
    if (num = count(60) + count(154) + count(219)) {
        if (date.after(getJstDate(2021, 4, 22, 12, 0, 0))) {
            if (["じゅんよう", "ひよう", "ずいほう", "ちとせ", "ちよだ"].indexOf(yomi) >= 0) {
                add({ fp: 1 }, num)
            }
            // 龍鳳、龍鳳改、祥鳳改
            if ([185, 318, 282].indexOf(shipId) >= 0) {
                add({ fp: 1 }, num)
            }
            // 龍鳳改二、龍鳳改二戊
            if ([888, 883].indexOf(shipId) >= 0) {
                add({ fp: 2 }, num)
            }
        }
    }
    // 二式艦上偵察機
    if (num = count(61)) {
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
        // 鈴谷航改二、熊野航改二、瑞鳳改二乙
        if ([508, 509, 560].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num, 1)
        }
        if (max >= 8) {
            // 蒼龍改二
            if (shipId === 197) {
                add({ fp: 1 }, num, 1)
            }
        }
    }
    // 12.7cm連装砲B型改二
    // if (num = count(63)) {}
    // 8cm高角砲
    // 8cm高角砲改+増設機銃
    // if (num = count(66) + count(220)) {}
    // 53cm艦首(酸素)魚雷
    // if (num = count(67)) {}
    // カ号観測機
    if (num = count(69)) {
        if (date.after(getJstDate(2020, 8, 27, 12, 0, 0))) {
            // 必要分のみ
            // 日向改二、加賀改二護
            if ([554, 646].indexOf(shipId) >= 0) {
                add({ fp: Number(shipId === 646), asw: 2 }, num)
            }
            // 伊勢改二
            if (shipId === 553) {
                add({ asw: 1 }, num)
            }
        }
    }
    // 三式指揮連絡機(対潜)
    if (num = count(70)) {
        if (yomi === "やましおまる") {
            add({ fp: 1, asw: 1 }, num)
        }
    }
    // 12.7cm単装砲
    // if (num = count(78)) {}
    // 瑞雲(六三四空)
    // 瑞雲12型(六三四空)
    // if (num = count(79) + count(81)) {}
    // 九七式艦攻(九三一空)
    if (num = count(82)) {
        if (date.after(getJstDate(2018, 8, 30, 18, 0, 0))) {
            // 大鷹型
            if (ctype === 76) {
                add({ asw: 1 }, num)
            }
        }
    }
    // 2cm 四連装FlaK 38
    if (num = count(84)) {
        if (date.after(getJstDate(2022, 1, 21, 18, 0, 0))) {
            var fp = Math.max.apply(null, items.filter(function(item) {
                return item.slotitemId === 84
            }).map(function(item) {
                if (item.level >= 7) return 1
                return 0
            }))
            if (GERMAN_SHIPS.indexOf(shipId) >= 0 || ITALIAN_SHIPS.indexOf(shipId) >= 0) {
                fp += items.some(function(item) {
                    return item.slotitemId === 84 && item.level === 10
                }) ? 1 : 0
            }
            add({ fp: fp }, num, 1)
        }
    }
    // 新型高温高圧缶
    // if (num = count(87)) {}
    // 20.3cm(2号)連装砲
    // if (num = count(90)) {}
    // 九七式艦攻(友永隊)
    if (num = count(93)) {
        if (date.after(getJstDate(2019, 4, 30, 21, 0, 0))) {
            if (yomi === "そうりゅう") {
                add({ fp: 1 }, num, 1)
            } else if (yomi === "ひりゅう") {
                add({ fp: 3 }, num, 1)
            }
        }
    }
    // 天山一二型(友永隊)
    if (num = count(94)) {
        if (date.after(getJstDate(2019, 4, 30, 21, 0, 0))) {
            if (shipId === 196) {
                // 飛龍改二
                add({ fp: 7 }, num, 1)
            } else if (shipId === 197) {
                // 蒼龍改二
                add({ fp: 3 }, num, 1)
            }
        }
    }
    // 九九式艦爆(江草隊)
    if (num = count(99)) {
        if (date.after(getJstDate(2019, 4, 30, 21, 0, 0))) {
            if (yomi === "そうりゅう") {
                add({ fp: 4 }, num, 1)
            } else if (yomi === "ひりゅう") {
                add({ fp: 1 }, num, 1)
            }
        }
    }
    // 彗星(江草隊)
    if (num = count(100)) {
        if (date.after(getJstDate(2019, 4, 30, 21, 0, 0))) {
            if (shipId === 196) {
                // 飛龍改二
                add({ fp: 3 }, num)
            } else if (shipId === 197) {
                // 蒼龍改二
                add({ fp: 6 }, num)
            }
        }
    }
    // 35.6cm連装砲(ダズル迷彩)
    // if (num = count(104)) {}
    // 13号対空電探改
    // if (num = count(106)) {}
    // Ar196改
    // if (num = count(115)) {}
    // 紫雲
    // if (num = count(118)) {}
    // 14cm連装砲
    // if (num = count(119)) {}
    // 94式高射装置
    // if (num = count(121)) {}
    // 10cm連装高角砲+高射装置
    // if (num = count(122)) {}
    // 51cm砲補正
    // if (num = count(128) + count(281)) {}
    // 熟練見張員
    if (num = count(129)) {
        if (date.after(getJstDate(2020, 3, 27, 12, 0, 0))) {
            if (JAPANESE_DD_SHIPS.indexOf(ctype) >= 0) {
                add({ asw: 2 }, num)
            }
        }
    }
    // 零式水中聴音機
    if (num = count(132)) {
        if (date.after(getJstDate(2022, 8, 4, 12, 0, 0))) {
            var asw = Math.max.apply(null, items.filter(function(item) {
                return item.slotitemId === 132
            }).map(function(item) {
                if (item.level >= 10) return 3
                if (item.level >= 8) return 2
                if (item.level >= 5) return 1
                return 0
            }))
            add({ asw: asw }, num, 1)
        }
    }
    // プリエーゼ式水中防御隔壁
    // if (num = count(136)) {}
    // 15.2cm連装砲改
    // if (num = count(139)) {}
    // 九七式艦攻(村田隊)
    if (num = count(143)) {
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
    if (num = count(144)) {
        if (date.after(getJstDate(2019, 4, 30, 21, 0, 0))) {
            if (yomi === "あかぎ") {
                add({ fp: 3 }, num, 1)
            } else if (yomi === "かが") {
                add({ fp: 2 }, num, 1)
            } else if (yomi === "しょうかく") {
                add({ fp: 2 }, num, 1)
                // 翔鶴改二、翔鶴改二甲
                if ([461, 466].indexOf(shipId) >= 0) {
                    add({ fp: 2 }, num, 1)
                }
            } else if (yomi === "ずいかく") {
                add({ fp: 1 }, num, 1)
                // 瑞鶴改二、瑞鶴改二甲
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
    // if (num = count(147) + count(393) + count(394)) {}
    // 四式水中聴音機
    if (num = count(149)) {
        if (date.after(getJstDate(2020, 1, 14, 12, 0, 0))) {
            if ([488, 141, 160, 622, 623, 656].indexOf(shipId) >= 0) {
                // 由良改二、五十鈴改二、那珂改二、夕張改二、夕張改二特、雪風改二
                add({ asw: 1 }, num, 1)
            } else if (shipId === 624) {
                // 夕張改二丁
                add({ asw: 3 }, num, 1)
            } else if (shipId === 662) {
                // 能代改二
                add({ asw: 2 }, num, 1)
            }
            // 秋月型
            if (ctype === 54) {
                add({ asw: 1 }, num, 1)
            }
        }
    }
    // 二式水戦改
    // 二式水戦改(熟練)
    // if (num = count(165) + count(216)) {}
    // OS2U
    if (num = count(171)) {
        if (date.after(getJstDate(2020, 5, 20, 12, 0, 0))) {
            if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
                if (getItemNum(items, 171, 10) > 0) {
                    add({ fp: 1 }, num, 1)
                }
            }
        }
    }
    // 53cm連装魚雷
    // if (num = count(174)) {}
    // 試製61cm六連装(酸素)魚雷
    // if (num = count(179)) {}
    // Re.2001 OR改
    if (num = count(184)) {
        // Aquila級
        if (ctype === 68) {
            add({ fp: 1 }, num)
        }
    }
    // Re.2001 G改
    if (num = count(188)) {
        // Aquila級
        if (ctype === 68) {
            add({ fp: 3 }, num)
        }
    }
    // Re.2005 改
    // if (num = count(189)) {}
    // Laté 298B
    // if (num = count(194)) {}
    // SBD
    if (num = count(195)) {
        if (date.after(getJstDate(2021, 5, 31, 19, 30, 0))) {
            if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
                add({ fp: 1 }, num)
            }
        }
    }
    // 艦本新設計 増設バルジ(大型艦)
    // if (num = count(204)) {}
    // 強風改
    // if (num = count(217)) {}
    // 8cm高角砲改+増設機銃
    // if (num = count(220)) {}
    // 二式爆雷
    if (num = count(227)) {
        if (date.after(getJstDate(2022, 8, 4, 12, 0, 0))) {
            var asw = items.filter(function(item) {
                return item.slotitemId === 227
            }).map(function(item) {
                return item.level >= 8 ? 1 : 0
            }).reduce(function(p, v) {
                return p + v
            }, 0)
            add({ asw: asw }, num, 1)
        }
    }
    // 九六式艦戦改
    if (num = count(228)) {
        if (date.after(getJstDate(2020, 3, 27, 12, 0, 0))) {
            if (yomi === "ほうしょう") {
                add({ fp: 3, asw: 4 }, num)
            }
            // 春日丸級、大鷹型
            if ([75, 76].indexOf(ctype) >= 0) {
                add({ fp: 2, asw: 5 }, num)
            }
            // 軽空母
            if (stype === STYPE.CVL) {
                add({ asw: 2 }, num)
            }
        } else if (date.after(getJstDate(2019, 8, 8, 12, 0, 0))) {
            if (yomi === "ほうしょう") {
                add({ fp: 1 }, num)
            }
            // 春日丸級、大鷹型
            if ([75, 76].indexOf(ctype) >= 0) {
                add({ fp: 1, asw: 2 }, num)
            }
            // 軽空母
            if (stype === 7) {
                add({ asw: 2 }, num)
            }
        }
    }
    // 12.7cm単装高角砲(後期型)
    if (num = count(229)) {
        if (date.after(getJstDate(2017, 6, 23, 12, 0, 0))) {
            // 雪風改二
            if (shipId === 656) {
                add({ asw: 2 }, num)
            }
        }
    }
    // 15.5cm三連装副砲改
    // if (num = count(234)) {}
    // 15.5cm三連装砲改
    // if (num = count(235)) {}
    // 瑞雲(六三四空/熟練)
    // 瑞雲改二(六三四空)
    // 瑞雲改二(六三四空/熟練)
    // if (num = count(237) + count(322) + count(323)) {}
    // 瑞雲(六三四空/熟練)
    // if (num = count(237)) {}
    // 零式水上偵察機11型乙
    // 零式水上偵察機11型乙(熟練)
    // if (num = count(238) + count(239)) {}
    // Swordfish
    if (num = count(242)) {
        if (date.after(getJstDate(2021, 2, 5, 12, 0, 0))) {
            // Ark Royal級
            if (ctype === 78) {
                add({ fp: 2 }, num)
            }
            if (yomi === "ほうしょう") {
                add({ fp: 1 }, num)
            }
        }
    }
    // Swordfish Mk.II(熟練)
    if (num = count(243)) {
        if (date.after(getJstDate(2021, 2, 5, 12, 0, 0))) {
            // Ark Royal級
            if (ctype === 78) {
                add({ fp: 3 }, num)
            }
            if (yomi === "ほうしょう") {
                add({ fp: 2 }, num)
            }
        }
    }
    // Swordfish Mk.III(熟練)
    if (num = count(244)) {
        if (date.after(getJstDate(2021, 2, 5, 12, 0, 0))) {
            // Ark Royal級
            if (ctype === 78) {
                add({ fp: 4 }, num)
            }
            if (yomi === "ほうしょう") {
                add({ fp: 3 }, num)
            }
        }
    }
    // 38cm四連装砲
    // 38cm四連装砲改
    // 38cm四連装砲改 deux
    // if (num = count(245) + count(246) + count(468)) {}
    // 15.2cm三連装砲
    // if (num = count(247)) {}
    // 12.7cm連装砲C型改二
    // if (num = count(266)) {}
    // 12.7cm連装砲D型改二
    // 12.7cm連装砲D型改三
    // if (num = count(267) + count(366)) {}
    // 北方迷彩(+北方装備)
    // if (num = count(268)) {}
    // 紫電改四
    if (num = count(271)) {
        if (date.after(getJstDate(2021, 9, 28, 12, 0, 0))) {
            // 鈴谷航改二、熊野航改二、龍鳳改二、龍鳳改二戊
            if ([508, 509, 888, 883].indexOf(shipId) >= 0) {
                var fp = items.filter(function(item) {
                    return item.slotitemId === 271
                }).map(function(item) {
                    if (item.level === 10) return 2
                    if (item.level >= 4) return 1
                    return 0
                }).reduce(function(p, v) {
                    return p + v
                }, 0)
                add({ fp: fp }, num, 1)
            }
        }
    }
    // FM-2
    if (num = count(277)) {
        if (date.after(getJstDate(2021, 7, 15, 12, 0, 0))) {
            if (AMERICAN_SHIPS.indexOf(ctype) >= 0 || BRITISH_SHIPS.indexOf(ctype) >= 0) {
                add({ fp: 1 }, num)
                if (ctype === 83) {
                    add({ fp: 1 }, num)
                }
            }
        }
    }
    // SK レーダー
    // if (num = count(278)) {}
    // SK+SG レーダー
    if (num = count(279)) {
        if (date.after(getJstDate(2020, 5, 20, 12, 0, 0))) {
            if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
                add({ fp: 2 }, num, 1)
            } else if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
                add({ fp: 1 }, num, 1)
            } else if (ctype === 96) {
                add({ fp: 1 }, num, 1)
            }
        }
    }
    // 130mm B-13連装砲
    // if (num = count(282)) {}
    // 533mm 三連装魚雷
    // if (num = count(283)) {}
    // 61cm三連装(酸素)魚雷後期型
    // if (num = count(285)) {}
    // 61cm四連装(酸素)魚雷後期型
    // if (num = count(286)) {}
    // 三式爆雷投射機 集中配備
    if (num = count(287)) {
        if (date.after(getJstDate(2020, 1, 14, 12, 0, 0))) {
            if ([488, 141, 160, 624, 656].indexOf(shipId) >= 0) {
                // 由良改二、五十鈴改二、那珂改二、夕張改二丁、雪風改二
                add({ asw: 1 }, num)
            } else if (shipId === 662) {
                // 能代改二
                add({ asw: 3 }, num)
            }
        }
    }
    // 試製15cm9連装対潜噴進砲
    if (num = count(288)) {
        if (date.after(getJstDate(2020, 1, 14, 12, 0, 0))) {
            if ([488, 141, 160, 656].indexOf(shipId) >= 0) {
                // 由良改二、五十鈴改二、那珂改二、雪風改二
                add({ asw: 2 }, num)
            } else if (shipId === 624) {
                // 夕張改二丁
                add({ asw: 3 }, num)
            } else if (shipId === 662) {
                // 能代改二
                add({ asw: 4 }, num)
            }
        }
    }
    // 35.6cm三連装砲改(ダズル迷彩仕様)
    // if (num = count(289)) {}
    // 41cm三連装砲改二
    // if (num = count(290)) {}
    // 彗星二二型(六三四空)
    // if (num = count(291)) {}
    // 彗星二二型(六三四空/熟練)
    // if (num = count(292)) {}
    // 12cm単装砲改二
    if (num = count(293)) {
        // 占守型、択捉型
        if ([74, 77].indexOf(ctype) >= 0) {
            if (hasSurfaceRadar(items)) {
                add({ asw: 1 }, num, 1)
            }
        }
    }
    // 12.7cm連装砲A型改二
    // if (num = count(294)) {}
    // 12.7cm連装砲A型改三(戦時改修)+高射装置
    // if (num = count(295)) {}
    // 12.7cm連装砲B型改四(戦時改修)+高射装置
    // if (num = count(296)) {}
    // 12.7cm連装砲A型
    // if (num = count(297)) {}
    // 16inch Mk.I三連装砲
    // 16inch Mk.I三連装砲+AFCT改
    // 16inch Mk.I三連装砲改+FCR type284
    // if (num = count(298) + count(299) + count(300)) {}
    // 20連装7inch UP Rocket Launchers
    // if (num = count(301)) {}
    // 九七式艦攻(九三一空/熟練)
    if (num = count(302)) {
        if (date.after(getJstDate(2018, 8, 30, 18, 0, 0))) {
            // 大鷹型
            if (ctype === 76) {
                add({ asw: 1 }, num)
            }
        }
    }
    // Bofors 15.2cm連装砲 Model 1930
    // if (num = count(303)) {}
    // S9 Osprey
    if (num = count(304)) {
        if ([16, 4, 20, 41].indexOf(ctype) >= 0) {
            // 川内型、球磨型、長良型、阿賀野型
            add({ asw: 1 }, num)
        } else if (ctype === 89) {
            // Gotland級
            add({ asw: 2 }, num)
        }
    }
    // Ju87C改二(KMX搭載機)
    // Ju87C改二(KMX搭載機/熟練)
    if (num = count(305) + count(306)) {
        if (date.after(getJstDate(2018, 8, 30, 18, 0, 0))) {
            // 大鷹型
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
    if (num = count(307)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // 5inch単装砲 Mk.30改+GFCS Mk.37
    // if (num = count(308)) {}
    // 14cm連装砲改
    if (num = count(310)) {
        if (date.after(getJstDate(2020, 1, 14, 12, 0, 0))) {
            // 夕張改二、夕張改二特、夕張改二丁
            if ([622, 623, 624].indexOf(shipId) >= 0) {
                add({ asw: 1 }, num)
            }
        }
    }
    // 5inch単装砲 Mk.30改
    // if (num = count(313)) {}
    // 533mm五連装魚雷(初期型)
    // if (num = count(314)) {}
    // SG レーダー(初期型)
    // if (num = count(315)) {}
    // Re.2001 CB改
    if (num = count(316)) {
        // Aquila級
        if (ctype === 68) {
            add({ fp: 4 }, num)
        }
    }
    // 三式弾改
    // if (num = count(317)) {}
    // 41cm連装砲改二
    // if (num = count(318)) {}
    // 彗星一二型(六三四空/三号爆弾搭載機)
    // if (num = count(319)) {}
    // 彗星一二型(三一号光電管爆弾搭載機)
    if (num = count(320)) {
        if (shipId === 196) {
            // 飛龍改二
            add({ fp: 3 }, num)
        } else if (shipId === 197) {
            // 蒼龍改二
            add({ fp: 3 }, num)
        } else if (shipId === 508) {
            // 鈴谷航改二
            add({ fp: 4 }, num)
        } else if (shipId === 509) {
            // 熊野航改二
            add({ fp: 4 }, num)
        }
    }
    // 瑞雲改二(六三四空)
    if (num = count(322)) {
        // 日向改二、伊勢改二
        if ([554, 553].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num)
        }
    }
    // 瑞雲改二(六三四空/熟練)
    if (num = count(323)) {
        // 日向改二、伊勢改二
        if ([554, 553].indexOf(shipId) >= 0) {
            add({ asw: 2 }, num)
        }
    }
    // オ号観測機改
    // オ号観測機改二
    if (num = count(324) + count(325)) {
        if (date.after(getJstDate(2020, 8, 27, 12, 0, 0))) {
            if ([554, 646].indexOf(shipId) >= 0) {
                // 554: 日向改二
                // 646: 加賀改二護
                add({ fp: (shipId === 646 ? 2 : 0), asw: 3 }, num)
            } else if (shipId === 553) {
                // 伊勢改二
                add({ asw: 2 }, num)
            }
        } else {
            if (shipId === 554) {
                // 日向改二
                add({ asw: 2 }, num)
            } else if (shipId === 553) {
                // 伊勢改二
                add({ asw: 1 }, num)
            }
        }
    }
    // S-51J
    if (num = count(326)) {
        if (date.after(getJstDate(2020, 8, 27, 12, 0, 0))) {
            if (shipId === 646) {
                // 加賀改二護
                add({ fp: 3, asw: 5 }, num)
            } else if (shipId === 554) {
                // 日向改二
                add({ asw: 4 }, num)
            } else if (shipId === 553) {
                // 伊勢改二
                add({ asw: 3 }, num)
            }
        } else {
            if (shipId === 554) {
                // 日向改二
                add({ asw: 3 }, num)
            } else if (shipId === 553) {
                // 伊勢改二
                add({ asw: 2 }, num)
            }
        }
    }
    // S-51J改
    if (num = count(327)) {
        if (date.after(getJstDate(2020, 8, 27, 12, 0, 0))) {
            if (shipId === 646) {
                // 加賀改二護
                add({ fp: 5, asw: 6 }, num)
            } else if (shipId === 554) {
                // 日向改二
                add({ asw: 5 }, num)
            } else if (shipId === 553) {
                // 伊勢改二
                add({ asw: 4 }, num)
            }
        } else {
            if (shipId === 554) {
                // 日向改二
                add({ asw: 4 }, num)
            } else if (shipId === 553) {
                // 伊勢改二
                add({ asw: 3 }, num)
            }
        }
    }
    // 35.6cm連装砲改
    // if (num = count(328)) {}
    // 35.6cm連装砲改二
    // if (num = count(329)) {}
    // 16inch Mk.I連装砲
    // 16inch Mk.V連装砲
    // 16inch Mk.VIII連装砲改
    // if (num = count(330) + count(331) + count(332)) {}
    // 烈風改(試製艦載型)
    // if (num = count(335)) {}
    // 烈風改二
    if (num = count(336)) {
        if ([277, 278].indexOf(shipId) >= 0) {
            // 赤城改、加賀改
            add({ fp: 1 }, num)
        } else if ([594, 599, 610, 646, 698].indexOf(shipId) >= 0) {
            // 赤城改二、赤城改二戊、加賀改二戊、加賀改二護、加賀改二
            add({ fp: 1 }, num)
        }
    }
    // 烈風改二(一航戦/熟練)
    if (num = count(337)) {
        if ([277, 278].indexOf(shipId) >= 0) {
            // 赤城改、加賀改
            add({ fp: 1 }, num)
        } else if ([594, 599, 610, 646, 698].indexOf(shipId) >= 0) {
            // 赤城改二、赤城改二戊、加賀改二戊、加賀改二護、加賀改二
            add({ fp: 2 }, num)
        }
    }
    // 烈風改二戊型
    if (num = count(338)) {
        if ([277, 278].indexOf(shipId) >= 0) {
            // 赤城改、加賀改
            add({ fp: 1 }, num)
        } else if ([594, 646, 698].indexOf(shipId) >= 0) {
            // 赤城改二、加賀改二護、加賀改二
            add({ fp: 1 }, num)
        } else if ([599, 610].indexOf(shipId) >= 0) {
            // 赤城改二戊、加賀改二戊
            add({ fp: 4 }, num)
        }
    }
    // 烈風改二戊型(一航戦/熟練)
    if (num = count(339)) {
        if ([277, 278].indexOf(shipId) >= 0) {
            // 赤城改、加賀改
            add({ fp: 1 }, num)
        } else if ([594, 646, 698].indexOf(shipId) >= 0) {
            // 赤城改二、加賀改二護、加賀改二
            add({ fp: 1 }, num)
        } else if ([599, 610].indexOf(shipId) >= 0) {
            // 赤城改二戊、加賀改二戊
            add({ fp: 6 }, num)
        }
    }
    // 152mm/55 三連装速射砲
    // if (num = count(340)) {}
    // 152mm/55 三連装速射砲改
    // if (num = count(341)) {}
    // 流星改(一航戦)
    if (num = count(342)) {
        if ([277, 278, 461, 466, 462, 467].indexOf(shipId) >= 0) {
            // 赤城改、加賀改、翔鶴改二、翔鶴改二甲、瑞鶴改二、瑞鶴改二甲
            add({ fp: 1 }, num)
        } else if ([594, 646, 698].indexOf(shipId) >= 0) {
            // 赤城改二、加賀改二護、加賀改二
            add({ fp: 2 }, num)
        } else if ([599, 610].indexOf(shipId) >= 0) {
            // 赤城改二戊、加賀改二戊
            add({ fp: 3 }, num)
        }
    }
    // 流星改(一航戦/熟練)
    if (num = count(343)) {
        if ([277, 278].indexOf(shipId) >= 0) {
            // 赤城改、加賀改
            add({ fp: 2 }, num)
        } else if ([461, 466, 462, 467].indexOf(shipId) >= 0) {
            // 翔鶴改二、翔鶴改二甲、瑞鶴改二、瑞鶴改二甲
            add({ fp: 1 }, num)
        } else if ([594, 646, 698].indexOf(shipId) >= 0) {
            // 赤城改二、加賀改二護、加賀改二
            add({ fp: 3 }, num)
        } else if ([599, 610].indexOf(shipId) >= 0) {
            // 赤城改二戊、加賀改二戊
            add({ fp: 5 }, num)
        }
    }
    // 九七式艦攻改 試製三号戊型(空六号電探改装備機)
    if (num = count(344)) {
        if ([599, 610].indexOf(shipId) >= 0) {
            // 赤城改二戊、加賀改二戊
            add({ fp: 3 }, num)
        } else if ([555, 560].indexOf(shipId) >= 0) {
            // 瑞鳳改二、瑞鳳改二乙
            add({ fp: 2, asw: 2 }, num)
        } else if (shipId === 318) {
            // 龍鳳改
            add({ fp: 4, asw: 1 }, num)
        } else if (shipId === 282) {
            // 祥鳳改
            add({ fp: 2, asw: 1 }, num)
        } else if (shipId === 888) {
            // 龍鳳改二
            add({ fp: 4, asw: 2 }, num)
        } else if (shipId === 883) {
            // 龍鳳改二戊
            add({ fp: 5, asw: 2 }, num)
        }
    }
    // 九七式艦攻改(熟練) 試製三号戊型(空六号電探改装備機)
    if (num = count(345)) {
        if ([599, 610].indexOf(shipId) >= 0) {
            // 赤城改二戊、加賀改二戊
            add({ fp: 3 }, num)
        } else if ([555, 560].indexOf(shipId) >= 0) {
            // 瑞鳳改二、瑞鳳改二乙
            add({ fp: 3, asw: 2 }, num)
        } else if (shipId === 318) {
            // 龍鳳改
            add({ fp: 5, asw: 1 }, num)
        } else if (shipId === 282) {
            // 祥鳳改
            add({ fp: 3, asw: 1 }, num)
        } else if (shipId === 888) {
            // 龍鳳改二
            add({ fp: 4, asw: 2 }, num)
        } else if (shipId === 883) {
            // 龍鳳改二戊
            add({ fp: 5, asw: 2 }, num)
        }
    }
    // 二式12cm迫撃砲改
    if (num = count(346)) {
        if (yomi === "やましおまる") {
            add({ asw: 1 }, num)
        }
    }
    // 二式12cm迫撃砲改 集中配備
    if (num = count(347)) {
        if (yomi === "やましおまる") {
            add({ asw: 2 }, num)
        }
    }
    // 8inch三連装砲 Mk.9
    // 8inch三連装砲 Mk.9 mod.2
    // if (num = count(356) + count(357)) {}
    // 5inch 単装高角砲群
    if (num = count(358)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0 || BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // 6inch 連装速射砲 Mk.XXI
    // if (num = count(359)) {}
    // Bofors 15cm連装速射砲 Mk.9 Model 1938
    // Bofors 15cm連装速射砲 Mk.9改+単装速射砲 Mk.10改 Model 1938
    // if (num = count(360) + count(361)) {}
    // 5inch連装両用砲(集中配備)
    // GFCS Mk.37+5inch連装両用砲(集中配備)
    // if (num = count(362) + count(363)) {}
    // 甲標的 丁型改(蛟龍改)
    // if (num = count(364)) {}
    // 一式徹甲弾改
    // if (num = count(365)) {}
    // Swordfish(水上機型)
    if (num = count(367)) {
        if (yomi === "ゴトランド") {
            add({ asw: 1 }, num)
        }
        if (ctype === 70) {
            // C.Teste級
            add({ asw: 1 }, num)
        } else if ([72, 62].indexOf(ctype) >= 0) {
            // 神威型、瑞穂型
            // 使用箇所なし
        } else if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            // 現状搭載不可
            add({ fp: 2 }, num)
        }
    }
    // Swordfish Mk.III改(水上機型)
    if (num = count(368)) {
        if (yomi === "ゴトランド") {
            add({ asw: 3 }, num)
        }
        if (ctype === 70) {
            // C.Teste級
            add({ asw: 3 }, num)
        } else if ([72, 62].indexOf(ctype) >= 0) {
            // 神威型、瑞穂型
            add({ asw: 2 }, num)
        } else if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            // 現状搭載不可
            add({ fp: (BRITISH_SHIPS.indexOf(ctype) >= 0 ? 2 : 0), asw: 2 }, num)
        }
    }
    // Swordfish Mk.III改(水上機型/熟練)
    if (num = count(369)) {
        if (yomi === "ゴトランド") {
            add({ asw: 4 }, num)
        }
        if (ctype === 70) {
            // C.Teste級
            add({ asw: 3 }, num)
        } else if ([72, 62].indexOf(ctype) >= 0) {
            // 神威型、瑞穂型
            add({ asw: 2 }, num)
        } else if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            // 現状搭載不可
            add({ fp: 2, asw: 2 }, num)
        }
    }
    // Swordfish Mk.II改(水偵型)
    if (num = count(370)) {
        if (yomi === "ゴトランド") {
            add({ asw: 3 }, num)
        }
        if (ctype === 70) {
            // C.Teste級
            add({ asw: 3 }, num)
        } else if ([72, 62].indexOf(ctype) >= 0) {
            // 神威型、瑞穂型
            add({ asw: 2 }, num)
        } else if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 2, asw: 3 }, num)
        }
    }
    // Fairey Seafox改
    if (num = count(371)) {
        if (yomi === "ゴトランド") {
            add({ asw: 2 }, num)
        }
        if (ctype === 70) {
            // C.Teste級
            add({ asw: 1 }, num)
        } else if (ctype === 79) {
            // Richelieu級
            // 使用箇所なし
        } else if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 3, asw: 1 }, num)
        }
    }
    // 天山一二型甲
    if (num = count(372)) {
        if (["しょうかく", "ずいかく", "たいほう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
        } else if (["じゅんよう", "ひよう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
        }
        if ([108, 109, 291, 292, 296, 297].indexOf(shipId) >= 0) {
            // 千歳航、千代田航、千歳航改、千代田航改、千歳航改二、千代田航改二
            add({ fp: 1 }, num)
        } else if ([116, 74, 117, 282, 185].indexOf(shipId) >= 0) {
            // 瑞鳳、祥鳳、瑞鳳改、祥鳳改、龍鳳
            add({ asw: 1 }, num)
        } else if ([560, 555, 318].indexOf(shipId) >= 0) {
            // 瑞鳳改二乙、瑞鳳改二、龍鳳改
            add({ asw: 1 }, num)
            add({ tp: 1 }, num, 1)
        } else if ([508, 509].indexOf(shipId) >= 0) {
            // 鈴谷航改二、熊野航改二
            add({ fp: 1 }, num)
        } else if ([883, 888].indexOf(shipId) >= 0) {
            // 龍鳳改二戊、龍鳳改二
            add({ fp: 2, asw: 1 }, num)
            add({ tp: 2 }, num, 1)
        }
    }
    // 天山一二型甲改(空六号電探改装備機)
    if (num = count(373)) {
        if (yomi === "しょうかく") {
            add({ fp: 2 }, num)
            add({ tp: 2 }, num, 1)
        } else if (yomi === "ずいかく") {
            add({ fp: 1 }, num)
            add({ tp: 2 }, num, 1)
        } else if (yomi === "たいほう") {
            add({ fp: 1 }, num)
            add({ tp: 2 }, num, 1)
        } else if (["じゅんよう", "ひよう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
            add({ tp: 1 }, num, 1)
        }
        if ([108, 109].indexOf(shipId) >= 0) {
            // 千歳航、千代田航
            add({ fp: 1 }, num)
        } else if ([291, 292].indexOf(shipId) >= 0) {
            // 千歳航改、千代田航改
            add({ fp: 1 }, num)
            add({ tp: 1 }, num, 1)
        } else if ([296, 297].indexOf(shipId) >= 0) {
            // 千歳航改二、千代田航改二
            add({ fp: 1 }, num)
            add({ tp: 1 }, num, 1)
        } else if ([116, 74].indexOf(shipId) >= 0) {
            // 瑞鳳、祥鳳
            add({ asw: 1 }, num)
        } else if ([117, 282, 185].indexOf(shipId) >= 0) {
            // 瑞鳳改、祥鳳改、龍鳳
            add({ fp: 1, asw: 1 }, num)
            add({ tp: 1 }, num, 1)
        } else if ([560, 555, 318].indexOf(shipId) >= 0) {
            // 瑞鳳改二乙、瑞鳳改二、龍鳳改
            add({ fp: 1, asw: 2 }, num)
            add({ tp: 1 }, num, 1)
        } else if ([508, 509].indexOf(shipId) >= 0) {
            // 鈴谷航改二、熊野航改二
            add({ fp: 1 }, num)
            add({ tp: 2 }, num, 1)
        } else if (shipId === 888) {
            // 龍鳳改二
            add({ fp: 2, asw: 2 }, num)
            add({ tp: 2 }, num, 1)
        } else if (shipId === 883) {
            // 龍鳳改二戊
            add({ fp: 1, asw: 2 }, num)
            add({ tp: 3 }, num, 1)
        }
    }
    // 天山一二型甲改(熟練/空六号電探改装備機)
    if (num = count(374)) {
        if (yomi === "しょうかく") {
            add({ fp: 3 }, num)
            add({ tp: 3 }, num, 1)
        } else if (yomi === "ずいかく") {
            add({ fp: 2 }, num)
            add({ tp: 3 }, num, 1)
        } else if (yomi === "たいほう") {
            add({ fp: 2 }, num)
            add({ tp: 3 }, num, 1)
        } else if (["じゅんよう", "ひよう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
            add({ tp: 2 }, num, 1)
        }
        if ([108, 109].indexOf(shipId) >= 0) {
            // 千歳航、千代田航
            add({ fp: 1 }, num)
            add({ tp: 1 }, num, 1)
        } else if ([291, 292].indexOf(shipId) >= 0) {
            // 千歳航改、千代田航改
            add({ fp: 1, asw: 1 }, num)
            add({ tp: 1 }, num, 1)
        } else if ([296, 297].indexOf(shipId) >= 0) {
            // 千歳航改二、千代田航改二
            add({ fp: 1, asw: 1 }, num)
            add({ tp: 1 }, num, 1)
        } else if ([116, 74].indexOf(shipId) >= 0) {
            // 瑞鳳、祥鳳
            add({ fp: 1, asw: 1 }, num)
        } else if ([117, 282, 185].indexOf(shipId) >= 0) {
            // 瑞鳳改、祥鳳改、龍鳳
            add({ fp: 1, asw: 2 }, num)
            add({ tp: 1 }, num, 1)
        } else if ([560, 555, 318].indexOf(shipId) >= 0) {
            // 瑞鳳改二乙、瑞鳳改二、龍鳳改
            add({ fp: 1, asw: 3 }, num)
            add({ tp: 1 }, num, 1)
        } else if ([508, 509].indexOf(shipId) >= 0) {
            // 鈴谷航改二、熊野航改二
            add({ fp: 1, asw: 2 }, num)
            add({ tp: 2 }, num, 1)
        } else if (shipId === 888) {
            // 龍鳳改二
            add({ fp: 3, asw: 3 }, num)
            add({ tp: 2 }, num, 1)
        } else if (shipId === 883) {
            // 龍鳳改二戊
            add({ fp: 2, asw: 3 }, num)
            add({ tp: 3 }, num, 1)
        }
    }
    // XF5U
    if (num = count(375)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 3, asw: 3 }, num)
        }
        if (yomi === "かが") {
            add({ fp: 1, asw: 1 }, num)
        }
    }
    // 533mm五連装魚雷(後期型)
    // if (num = count(376)) {}
    // RUR-4A Weapon Alpha改
    if (num = count(377)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 2 }, num, 1)
            // Fletcher Mk.II
            if (shipId === 629) {
                add({ asw: 1 }, num, 1)
            }
        } else if (BRITISH_SHIPS.indexOf(ctype) >= 0 || AUSTRALIAN_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 1 }, num, 1)
        }
        // 丹陽、雪風改二
        if ([651, 656].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num, 1)
        }
    }
    // 対潜短魚雷(試作初期型)
    if (num = count(378)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 3 }, num, 1)
            // Fletcher Mk.II
            if (shipId === 629) {
                add({ asw: 1 }, num, 1)
            }
        } else if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 2 }, num, 1)
        } else if (ctype === 96) {
            // Perth級
            add({ asw: 1 }, num, 1)
        }
        // 丹陽、雪風改二
        if ([651, 656].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num, 1)
        }
    }
    // 12.7cm単装高角砲改二
    if (num = count(379)) {
        if (["ゆら", "なか", "きぬ", "いすず", "ゆうばり"].indexOf(yomi) >= 0) {
            add({ asw: 1 }, num)
        }
        // 雪風改二
        if (shipId === 656) {
            add({ asw: 2 }, num)
        }
        // 由良改二、那珂改二、鬼怒改二、五十鈴改二
        if ([488, 160, 487, 141].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num)
        }
        // 天龍改二、龍田改二、夕張改二丁
        if ([477, 478, 624].indexOf(shipId) >= 0) {
            add({ asw: 2 }, num)
        }
    }
    // 12.7cm連装高角砲改二
    if (num = count(380)) {
        if (["ゆら", "なか", "きぬ", "いすず", "ゆうばり"].indexOf(yomi) >= 0) {
            add({ asw: 1 }, num)
        }
        // 由良改二、那珂改二、鬼怒改二、五十鈴改二
        if ([488, 160, 487, 141].indexOf(shipId) >= 0) {
            add({ asw: 1 }, num)
        }
        // 天龍改二、龍田改二、夕張改二丁
        if ([477, 478, 624].indexOf(shipId) >= 0) {
            add({ asw: 2 }, num)
        }
    }
    // 16inch三連装砲 Mk.6
    // if (num = count(381)) {}
    // 12cm単装高角砲E型
    if (num = count(382)) {
        // 海防艦
        if (stype === STYPE.DE) {
            add({ asw: 1 }, num)
        }
    }
    // 後期型53cm艦首魚雷(8門)
    // if (num = count(383)) {}
    // 後期型潜水艦搭載電探&逆探
    // if (num = count(384)) {}
    // 16inch三連装砲 Mk.6 mod.2
    // if (num = count(385)) {}
    // 6inch三連装速射砲 Mk.16
    // if (num = count(386)) {}
    // 6inch三連装速射砲 Mk.16 mod.2
    // if (num = count(387)) {}
    // TBM-3W+3S
    if (num = count(389)) {
        if ([594, 599].indexOf(shipId) >= 0) {
            // 赤城改二、赤城改二戊
            add({ fp: 2 }, num)
        } else if ([698, 610].indexOf(shipId) >= 0) {
            // 加賀改二、加賀改二戊
            add({ fp: 3 }, num)
        } else if (shipId === 646) {
            // 加賀改二護
            add({ fp: 4, asw: 4 }, num)
            // オートジャイロ
            if (items.some(function(item) { return item.type2 === 25 })) {
                add({ fp: 3, asw: 6 }, num, 1)
            }
            // S-51J、S-51J改
            if (count(326) + count(327)) {
                add({ fp: 5, asw: 4 }, num, 1)
            }
        }
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: (AMERICAN_SHIPS.indexOf(ctype) >= 0 ? 2 : 0), asw: 3 }, num)
        }
    }
    // 16inch三連装砲 Mk.6+GFCS
    // if (num = count(390)) {}
    // 九九式艦爆二二型
    if (num = count(391)) {
        if (["しょうかく", "ずいかく", "じゅんよう", "ひよう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
        }
        if ([116, 185, 282].indexOf(shipId) >= 0) {
            // 瑞鳳、龍鳳、祥鳳改
            add({ fp: 1 }, num)
        } else if ([117, 318, 883, 888].indexOf(shipId) >= 0) {
            // 瑞鳳改、龍鳳改、龍鳳改二戊、龍鳳改二
            add({ fp: 1 }, num)
        } else if ([560, 555].indexOf(shipId) >= 0) {
            // 瑞鳳改二乙、瑞鳳改二
            add({ fp: 1 }, num)
        }
    }
    // 九九式艦爆二二型(熟練)
    if (num = count(392)) {
        if (["しょうかく", "ずいかく"].indexOf(yomi) >= 0) {
            add({ fp: 2 }, num)
        } else if (["じゅんよう", "ひよう"].indexOf(yomi) >= 0) {
            add({ fp: 1 }, num)
        }
        if ([116, 185, 282].indexOf(shipId) >= 0) {
            // 瑞鳳、龍鳳、祥鳳改
            add({ fp: 2 }, num)
        } else if ([117, 318, 883, 888].indexOf(shipId) >= 0) {
            // 瑞鳳改、龍鳳改、龍鳳改二戊、龍鳳改二
            add({ fp: 2 }, num)
        } else if ([560, 555].indexOf(shipId) >= 0) {
            // 瑞鳳改二乙、瑞鳳改二
            add({ fp: 3 }, num)
        }
    }
    // 現地改装12.7cm連装高角砲
    // if (num = count(397)) {}
    // 現地改装10cm連装高角砲
    // if (num = count(398)) {}
    // 6inch Mk.XXIII三連装砲
    // if (num = count(399)) {}
    // 533mm 三連装魚雷(53-39型)
    // if (num = count(400)) {}
    // 15.2cm連装砲改二
    // if (num = count(407)) {}
    // 装甲艇(AB艇)
    // if (num = count(408)) {}
    // 武装大発
    // if (num = count(409)) {}
    // 42号対空電探改二
    // if (num = count(411)) {}
    // 水雷戦隊 熟練見張員
    if (num = count(412)) {
        if (JAPANESE_DD_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 2 }, num)
        }
    }
    // 精鋭水雷戦隊 司令部
    // if (num = count(413)) {}
    // SOC Seagull
    // if (num = count(414)) {}
    // SO3C Seamew改
    if (num = count(415)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 1 }, num, 1)
        }
    }
    // SBD-5
    if (num = count(419)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            var fp = items.filter(function(item) {
                return item.slotitemId === 419
            }).map(function(item) {
                if (item.level >= 7) return 4
                if (item.level >= 2) return 3
                return 2
            }).reduce(function(p, v) {
                return p + v
            }, 0)
            add({ fp: fp }, num, 1)
        }
    }
    // SB2C-3
    if (num = count(420)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0 || BRITISH_SHIPS.indexOf(ctype) >= 0) {
            var fp = items.filter(function(item) {
                return item.slotitemId === 420
            }).map(function(item) {
                return item.level >= 3 ? 1 : 0
            }).map(function(power) {
                // Essex級
                if (ctype === 84) return power + 1
                // Ark Royal級
                if (ctype === 78) return power - 1
                return power
            }).reduce(function(p, v) {
                return p + v + 1
            }, 0)
            add({ fp: fp }, num, 1)
        }
        // 軽空母
        if (stype === STYPE.CVL) {
            add({ fp: -2 }, num)
        }
    }
    // SB2C-5
    if (num = count(421)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0 || BRITISH_SHIPS.indexOf(ctype) >= 0) {
            var fp = items.filter(function(item) {
                return item.slotitemId === 421
            }).map(function(item) {
                return item.level >= 5 ? 1 : 0
            }).map(function(power) {
                // Essex級
                if (ctype === 84) return power + 1
                // Ark Royal級
                if (ctype === 78) return power - 1
                return power
            }).reduce(function(p, v) {
                return p + v + 2
            }, 0)
            add({ fp: fp }, num, 1)
        }
        // 軽空母
        if (stype === STYPE.CVL) {
            add({ fp: -2 }, num)
        }
    }
    // FR-1 Fireball
    if (num = count(422)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0 || BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
            // Essex級
            if (ctype === 84) {
                add({ fp: 1 }, num)
            }
            // Gambier Bay Mk.II
            if (shipId === 707) {
                add({ fp: 2 }, num)
            }
        }
    }
    // Fulmar(戦闘偵察/熟練)
    if (num = count(423)) {
        // Ark Royal級
        if (ctype === 78) {
            add({ fp: 2 }, num)
        }
        if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 2 }, num)
        } else if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // Barracuda Mk.II
    if (num = count(424)) {
        if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 2, tp: 3 }, num)
            var fp = items.filter(function(item) {
                return item.slotitemId === 424
            }).map(function(item) {
                if (item.level >= 6) return 2
                if (item.level >= 2) return 1
                return 0
            }).reduce(function(p, v) {
                return p + v
            }, 0)
            add({ fp: fp }, num, 1)
        }
    }
    // Barracuda Mk.III
    if (num = count(425)) {
        if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 2, asw: 2 }, num)
            var fp = items.filter(function(item) {
                return item.slotitemId === 425
            }).map(function(item) {
                if (item.level >= 4) return 1
                return 0
            }).reduce(function(p, v) {
                return p + v
            }, 0)
            var asw = items.filter(function(item) {
                return item.slotitemId === 425
            }).map(function(item) {
                if (item.level === 10) return 3
                if (item.level >= 6) return 2
                if (item.level >= 2) return 1
                return 0
            }).reduce(function(p, v) {
                return p + v
            }, 0)
            add({ fp: fp, asw: asw }, num, 1)
        }
    }
    // 305mm/46 連装砲
    // 305mm/46 三連装砲
    // 320mm/44 連装砲
    // 320mm/44 三連装砲
    // if (num = count(426) + count(427) + count(428) + count(429)) {}
    // 65mm/64 単装速射砲改
    // if (num = count(430)) {}
    // Corsair Mk.II
    // Corsair Mk.II(Ace)
    if (num = count(434) + count(435)) {
        // Illustrious級
        if (ctype === 112) {
            add({ fp: 1 }, num)
        }
        if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
        } else if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // 試製 陣風
    if (num = count(437)) {
        if (shipId === 285) {
            // 鳳翔改
            add({ fp: 3 }, num)
        } else if ([196, 197].indexOf(shipId) >= 0) {
            // 飛龍改二、蒼龍改二
            add({ fp: 2 }, num)
        } else if ([508, 509, 646].indexOf(shipId) >= 0) {
            // 鈴谷航改二、熊野航改二、加賀改二護
            add({ fp: 2 }, num)
        } else if ([888, 883, 553, 554].indexOf(shipId) >= 0) {
            // 龍鳳改二、龍鳳改二戊、伊勢改二、日向改二
            add({ fp: 1 }, num)
        }
    }
    // 三式水中探信儀改
    if (num = count(438)) {
        if (JAPANESE_DD_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 1 }, num)
        }
        if ([160, 488, 141].indexOf(shipId) >= 0) {
            // 那珂改二、由良改二、五十鈴改二
            add({ asw: 1 }, num)
        } else if ([145, 588, 667, 578, 476, 363].indexOf(shipId) >= 0) {
            // 時雨改二、山風改二、山風改二丁、朝霜改二、神風改、春風改
            var asw = Math.max.apply(null, items.filter(function(item) {
                return item.slotitemId === 438
            }).map(function(item) {
                if (item.level >= 8) return 2
                if (item.level >= 4) return 1
                return 0
            }))
            add({ asw: asw }, num, 1)
        }
        if (["うしお", "まいかぜ", "いそかぜ", "はまかぜ", "いかづち", "やまぐも", "うみかぜ", "かわかぜ", "すずかぜ"].indexOf(yomi) >= 0) {
            add({ asw: 1 }, num)
        } else if (["しぐれ", "やまかぜ", "かみかぜ", "はるかぜ", "みくら", "いしがき"].indexOf(yomi) >= 0) {
            add({ asw: 1 }, num)
        }
    }
    // Hedgehog(初期型)
    if (num = count(439)) {
        // 海防艦、駆逐艦、軽巡洋艦、練習巡洋艦
        if ([STYPE.DE, STYPE.DD, STYPE.CL, STYPE.CT].indexOf(stype) >= 0) {
            add({ asw: 1 }, num, 1)
        }
        // 松型、海防艦
        if (ctype === 101 || stype === STYPE.DE) {
            add({ asw: 1 }, num, 1)
        }
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0 || BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 2 }, num, 1)
        }
    }
    // 21inch艦首魚雷発射管6門(初期型)
    // 21inch艦首魚雷発射管6門(後期型)
    // if (num = count(440) + count(441)) {}
    // 潜水艦後部魚雷発射管4門(初期型)
    // 潜水艦後部魚雷発射管4門(後期型)
    // if (num = count(440) + count(443)) {}
    // 零式艦戦64型(複座KMX搭載機)
    if (num = count(447)) {
        // 大鷹型
        if (ctype === 76) {
            add({ fp: 1, asw: 1 }, num)
        }
        if (yomi === "うんよう") {
            add({ fp: 1, asw: 1 }, num)
        } else if (["ほうしょう", "たいげい・りゅうほう"].indexOf(yomi) >= 0) {
            add({ fp: 1, asw: 2 }, num)
        }
        var fp = Math.max.apply(null, items.filter(function(item) {
            return item.slotitemId === 447
        }).map(function(item) {
            if (item.level >= 2) return 1
            return 0
        }))
        var asw = Math.max.apply(null, items.filter(function(item) {
            return item.slotitemId === 447
        }).map(function(item) {
            if (item.level === 10) return 2
            if (item.level >= 6) return 1
            return 0
        }))
        add({ fp: fp, asw: asw }, num, 1)
    }
    // 13号対空電探改(後期型)
    // if (num = count(450)) {}
    // 三式指揮連絡機改
    if (num = count(451)) {
        if (date.after(getJstDate(2022, 7, 13, 12, 0, 0))) {
            if (yomi === "あきつまる") {
                add({ asw: 2 }, num)
                // あきつ丸改
                if (shipId === 166) {
                    var asw = Math.max.apply(null, items.filter(function(item) {
                        return item.slotitemId === 451
                    }).map(function(item) {
                        if (item.level >= 7) return 2
                        if (item.level >= 3) return 1
                        return 0
                    }))
                    add({ asw: asw }, num, 1)
                }
            }
            if (yomi === "やましおまる") {
                add({ asw: 3 }, num)
                var asw = Math.max.apply(null, items.filter(function(item) {
                    return item.slotitemId === 451
                }).map(function(item) {
                    if (item.level >= 8) return 2
                    if (item.level >= 3) return 1
                    return 0
                }))
                add({ asw: asw }, num, 1)
            }
        } else {
            if (yomi === "あきつまる") {
                add({ asw: 2 }, num)
            }
            if (yomi === "やましおまる") {
                add({ asw: 3 }, num)
            }
        }
    }
    // 試製 長12.7cm連装砲A型改四
    if (num = count(455)) {
        // 浦波改二
        if (shipId === 647) {
            add({ asw: 1 }, num)
        }
    }
    // SG レーダー(後期型)
    // if (num = count(456)) {}
    // 15.5cm三連装副砲改二
    // if (num = count(463)) {}
    // 10cm連装高角砲群 集中配備
    // if (num = count(464)) {}
    // 試製51cm三連装砲
    // if (num = count(465)) {}
    // 流星改(熟練)
    if (num = count(466)) {
        if ([277, 278, 156, 288, 112, 280, 279].indexOf(shipId) >= 0) {
            // 赤城改、加賀改、大鳳改、翔鶴改、瑞鶴改、飛龍改、蒼龍改
            add({ fp: 1 }, num)
        } else if ([461, 462, 466, 467].indexOf(shipId) >= 0) {
            // 翔鶴改二、瑞鶴改二、翔鶴改二甲、瑞鶴改二甲
            add({ fp: 1 }, num)
        }
    }
    // 5inch連装砲(副砲配置) 集中配備
    // if (num = count(467)) {}
    // 12.7cm連装砲C型改三
    // if (num = count(470)) {}
    // Loire 130M
    // if (num = count(471)) {}
    // Mk.32 対潜魚雷(Mk.2落射機)
    if (num = count(472)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 2 }, num)
        }
        if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ asw: 1 }, num)
        }
        // Samuel B.Roberts Mk.II
        if (shipId === 920) {
            add({ asw: 1 }, num, 1)
        }
    }
    // F4U-2 Night Corsair
    if (num = count(473)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
        }
        if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // F4U-4
    if (num = count(474)) {
        if (AMERICAN_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 2 }, num)
        }
        if (BRITISH_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
        }
        if (FRENCH_SHIPS.indexOf(ctype) >= 0) {
            add({ fp: 1 }, num)
        }
        // Gambier Bay Mk.II、Langley改
        if ([707, 930].indexOf(shipId) >= 0) {
            add({ fp: 1 }, num)
        }
    }
    // 熟練甲板要員+航空整備員
    if (num = count(478)) {
        var fp = Math.max.apply(null, items.filter(function(item) {
            return item.slotitemId === 478
        }).map(function(item) {
            if (item.level === 10) return 3
            if (item.level >= 7) return 2
            if (item.level >= 1) return 1
            return 0
        }))
        var tp = Math.max.apply(null, items.filter(function(item) {
            return item.slotitemId === 478
        }).map(function(item) {
            if (item.level >= 5) return 1
            return 0
        }))
        var bomb = Math.max.apply(null, items.filter(function(item) {
            return item.slotitemId === 478
        }).map(function(item) {
            if (item.level >= 4) return 1
            return 0
        }))
        add({ fp: fp, tp: tp, bomb: bomb }, num, 1)
    }
    return bonus
}

//#endregion

//#endregion
