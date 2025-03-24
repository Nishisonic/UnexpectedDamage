/**
 * 異常ダメージ検知
 * @version 3.3.0
 * @author Nishikuma
 */

//#region Library
load("script/ScriptData.js")
load("script/UnexpectedDamage.js")
ComparableArrayType = Java.type("java.lang.Comparable[]")
System = Java.type("java.lang.System")
URI = Java.type("java.net.URI")
StandardCharsets = Java.type("java.nio.charset.StandardCharsets")
Files = Java.type("java.nio.file.Files")
Paths = Java.type("java.nio.file.Paths")
StandardOpenOption = Java.type("java.nio.file.StandardOpenOption")
Collectors = Java.type("java.util.stream.Collectors")
BattlePhaseKind = Java.type("logbook.dto.BattlePhaseKind")
EnemyShipDto = Java.type("logbook.dto.EnemyShipDto")
Item = Java.type("logbook.internal.Item")
IOUtils = Java.type("org.apache.commons.io.IOUtils")
//#endregion

//#region 全般

//#region メモ部分
// ・洋上補給には拡張版は対応していない
//    ・v1.6.2で擬似的に対応
// ・渦潮には拡張版は対応していない
//#endregion

//#region 主部分

function header() {
    return ["昼砲撃戦", "昼雷撃戦", "夜戦"]
}

function begin() {
    updateFile()
    loadAkakariLogIfNeeded()
    setTmpData("ini", false)
    setTmpData("unexpected", {})
}

/**
 * @param {logbook.dto.BattleExDto} battle
 */
function body(battle) {
    var ret = new ComparableArrayType(3)
    var date = battle.getBattleDate()
    if (!isInvestiagate(battle)) return ret
    // 自艦隊情報
    var friends = getFriends(battle)
    // 敵艦隊情報
    var enemies = getEnemies(battle)
    // 自艦隊Hp
    var friendHp = getFriendHp(battle)
    // 敵艦隊Hp
    var enemyHp = getEnemyHp(battle)
    // 戦闘データ
    var battleData = parse(date, battle.mapCellDto, Java.from(battle.phaseList), friendHp.main.length, friendHp.escort.length, enemyHp.main.length, enemyHp.escort.length, calcCombinedKind(battle), battle.isEnemyCombined())
    return detectOrDefault(date, battleData, friends, enemies, friendHp, enemyHp)
}

function end() {
    setTmpData("ini", true)
}

/**
 * 赤仮の出撃ログを本体より先に読み込む
 */
function loadAkakariLogIfNeeded() {
    if (!isAkakari) return

    ApplicationMain = Java.type("logbook.gui.ApplicationMain")
    AkakariSyutsugekiLogReader = Java.type("logbook.builtinscript.akakariLog.AkakariSyutsugekiLogReader")

    try {
        if(AkakariSyutsugekiLogReader.needConvert()) {
            ApplicationMain.logPrint("赤仮出撃ログのコンバート開始<<UnexpectedDamage>>")
            AkakariSyutsugekiLogReader.convertAllOldLog()
            ApplicationMain.logPrint("赤仮出撃ログのコンバート完了<<UnexpectedDamage>>")
        }
    } catch (e) { 
        ApplicationMain.logPrint("赤仮出撃ログのコンバートに失敗しました<<UnexpectedDamage>>")
    }
    try {
        ApplicationMain.logPrint("赤仮出撃ログの圧縮開始<<UnexpectedDamage>>")
        AkakariSyutsugekiLogReader.allRawLogToZstdLog()
        ApplicationMain.logPrint("赤仮出撃ログの圧縮完了<<UnexpectedDamage>>")
    } catch (e){
        ApplicationMain.logPrint("赤仮出撃ログの圧縮に失敗しました<<UnexpectedDamage>>")
    }
    try {
        ApplicationMain.logPrint("赤仮出撃ログの読み込み中<<UnexpectedDamage>>")
        AkakariSyutsugekiLogReader.loadAllStartPortDate()
        ApplicationMain.logPrint("赤仮出撃ログの読み込み完了<<UnexpectedDamage>>")
    } catch (e) {
        ApplicationMain.logPrint("赤仮出撃ログの読み込みに失敗しました<<UnexpectedDamage>>")
    }
}

/**
 * ファイルをアップデートします
 */
function updateFile() {
    try {
        var cv = VERSION.split(".")
        var nv = JSON.parse(IOUtils.toString(URI.create(UPDATE_CHECK_URL), StandardCharsets.UTF_8)).tag_name.replace(/^v(.*)$/, "$1").split(".")
        if (
            Number(nv[0]) > Number(cv[0]) ||
            (Number(nv[0]) === Number(cv[0]) && Number(nv[1]) > Number(cv[1])) ||
            (Number(nv[0]) === Number(cv[0]) && Number(nv[1]) === Number(cv[1]) && Number(nv[2]) > Number(cv[2]))
        ) {
            FILE_URL.forEach(function (url, i) {
                IOUtils.write(IOUtils.toString(URI.create(url), StandardCharsets.UTF_8), Files.newOutputStream(Paths.get(EXECUTABLE_FILE[i]), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING), StandardCharsets.UTF_8)
            })
        }
    } catch (e) {
        System.out.println("File Update Failed.")
        e.printStackTrace()
    }
}

//#endregion

//#region 拡張版からデータを貰う処理

/**
 * 調査するかどうか
 * @param {logbook.dto.BattleExDto} battle
 * @return {Boolean} 調査するか
 */
var isInvestiagate = function (battle) {
    var END_1ST_MAP_DATE = getJstDate(2018, 8, 15, 13, 0, 0)
    var MAELSTROM_MAP_LIST = [
        [6, 2],
        [7, 1],
    ]
    return battle.exVersion >= 2  // version確認
        // 演習は除外
        && !battle.isPractice()
        // 一期のデータは除外
        && battle.battleDate.after(END_1ST_MAP_DATE)
        // 渦潮(弾薬減)マップ除外
        && !(MAELSTROM_MAP_LIST.some(function (map) { return map[0] === battle.mapCellDto.map[0] && map[1] === battle.mapCellDto.map[1] }))
        // 過去のイベント分は除外
        && !(battle.mapCellDto.map[0] >= 22 && battle.mapCellDto.map[0] <= 54)
        // 敵装備ID+1000以前のデータは読まないようにする(暫定対応)
        && battle.battleDate.after(getJstDate(2022, 11, 9, 12, 0, 0))
    // 何らかのフィルタを条件する際はここに追加
}

/**
 * 自艦隊情報を取得する
 * @param {logbook.dto.BattleExDto} battle
 * @return {FleetDto} 自艦隊情報
 */
var getFriends = function (battle) {
    var dock = battle.dock
    var dockCombined = battle.dockCombined
    if (dockCombined) {
        return new FleetDto(dock.ships, dockCombined.ships, battle.dock.escaped, battle.dockCombined.escaped)
    } else {
        return new FleetDto(dock.ships, undefined, battle.dock.escaped, undefined)
    }
}

/**
 * 敵艦隊情報を取得する
 * @param {logbook.dto.BattleExDto} battle
 * @return {FleetDto} 敵艦隊情報
 */
var getEnemies = function (battle) {
    var enemy = battle.enemy
    var enemyCombined = battle.enemyCombined
    if (enemyCombined) {
        return new FleetDto(enemy, enemyCombined, undefined, undefined)
    } else {
        return new FleetDto(enemy, undefined, undefined, undefined)
    }
}

/**
 * 自艦隊Hpを取得する
 * @param {logbook.dto.BattleExDto} battle
 * @return {FleetHpDto} 自艦隊HP
 */
var getFriendHp = function (battle) {
    var maxHp = battle.maxFriendHp
    var maxHpCombined = battle.maxFriendHpCombined
    var startHp = battle.startFriendHp
    var startHpCombined = battle.startFriendHpCombined
    var endHp = battle.nowFriendHp
    var endHpCombined = battle.nowFriendHpCombined
    var main = []
    var escort = []
    for (var i in maxHp) {
        main.push(new ShipHpDto(maxHp[i], startHp[i], startHp[i], endHp[i]))
    }
    for (var i in maxHpCombined) {
        escort.push(new ShipHpDto(maxHpCombined[i], startHpCombined[i], startHpCombined[i], endHpCombined[i]))
    }
    return new FleetHpDto(main, escort)
}

/**
 * 敵艦隊Hpを取得する
 * @param {logbook.dto.BattleExDto} battle
 * @return {FleetHpDto} 敵艦隊HP
 */
var getEnemyHp = function (battle) {
    var maxHp = battle.maxEnemyHp
    var maxHpCombined = battle.maxEnemyHpCombined
    var startHp = battle.startEnemyHp
    var startHpCombined = battle.startEnemyHpCombined
    var endHp = battle.nowEnemyHp
    var endHpCombined = battle.nowEnemyHpCombined
    var main = []
    var escort = []
    for (var i in maxHp) {
        main.push(new ShipHpDto(maxHp[i], startHp[i], startHp[i], endHp[i]))
    }
    for (var i in maxHpCombined) {
        escort.push(new ShipHpDto(maxHpCombined[i], startHpCombined[i], startHpCombined[i], endHpCombined[i]))
    }
    return new FleetHpDto(main, escort)
}

/**
 * 艦隊
 * @param {java.util.List<logbook.dto.ShipDto|logbook.dto.EnemyShipDto>} m 主力
 * @param {java.util.List<logbook.dto.ShipDto|logbook.dto.EnemyShipDto>} e 随伴
 * @param {boolean[]} me 待避主力
 * @param {boolean[]} ee 待避随伴
 */
var FleetDto = function (m, e, me, ee) {
    this.main = m
    this.escort = e
    this.mainEscaped = me
    this.escortEscaped = ee
}

/**
 * 艦隊Hp
 * @param {[ShipHpDto]} m 主力
 * @param {[ShipHpDto]} e 随伴
 */
var FleetHpDto = function (m, e) {
    this.main = m
    this.escort = e
}

/**
 * ダメージHp
 * @param {[number]} m 主力
 * @param {[number]} e 随伴
 */
var DamagedHpDto = function (m, e) {
    this.main = m
    this.escort = e
}

/**
 * ダメージを加算
 * @param {DamagedHpDto} hpdto ダメージ
 */
DamagedHpDto.prototype.add = function (hpdto) {
    for (var i in this.main) {
        this.main[i] = Math.floor(hpdto.main[i])
    }
    for (var i in this.escort) {
        this.escort[i] = Math.floor(hpdto.escort[i])
    }
}

/**
 * 攻撃側/防御側情報
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃側情報
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御側情報
 */
var InvolvedShipsDto = function (attacker, defender) {
    this.attacker = attacker
    this.defender = defender
}

/**
 * 攻撃側/防御側Hp
 * @param {ShipHpDto} attacker 攻撃側Hp
 * @param {ShipHpDto} defender 防御側Hp
 */
var InvolvedShipHpsDto = function (attacker, defender) {
    this.attacker = attacker
    this.defender = defender
}

/**
 * Hp情報
 * @param {Number} max 最大Hp
 * @param {Number} start 交戦前Hp
 * @param {Number} now 交戦中Hp
 * @param {Number} end 交戦後Hp
 */
var ShipHpDto = function (max, start, now, end) {
    this.max = max
    this.start = start
    this.now = now
    this.end = end
}

/**
 * 轟沈か(nowで判定)
 * @return {Boolean}
 */
ShipHpDto.prototype.isSunkDamage = function () {
    return this.now <= 0
}

/**
 * 大破か(nowとmaxで判定)
 * 轟沈でもtrueになるので注意
 * @return {Boolean}
 */
ShipHpDto.prototype.isBadlyDamage = function () {
    return this.now / this.max <= 0.25
}

/**
 * 中破か(nowとmaxで判定)
 * 轟沈or大破でもtrueになるので注意
 * @return {Boolean}
 */
ShipHpDto.prototype.isHalfDamage = function () {
    return this.now / this.max <= 0.5
}

/**
 * 現在保持しているデータを元にコピーして返す
 * @return {ShipHpDto}
 */
ShipHpDto.prototype.copy = function () {
    return new ShipHpDto(this.max, this.start, this.now, this.end)
}

/**
 * HP[文字列]を返す
 * @return {String}
 */
ShipHpDto.prototype.toString = function () {
    return "[" + this.now + "/" + this.max + "]"
}

//#endregion

//#region API(Json)を解析する処理

/**
 * API(Json)を解析して既定のフォーマットに収めて返す
 * @param {java.util.Date} date 日付
 * @param {logbook.dto.MapCellDto} mapCell マップ
 * @param {[logbook.dto.BattleExDto.Phase]} phaseList フェーズリスト(昼戦/夜戦)
 * @param {Number} friendNum 自艦隊本隊数
 * @param {Number} friendNumCombined 自艦隊随伴数
 * @param {Number} enemyNum 敵艦隊本隊数
 * @param {Number} enemyNumCombined 敵艦隊随伴数
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @return {Battle} 既定のフォーマット
 */
var parse = function (date, mapCell, phaseList, friendNum, friendNumCombined, enemyNum, enemyNumCombined, friendCombinedKind, isEnemyCombined) {
    var airDamagedFriendHp = new DamagedHpDto(Array.apply(null, { length: friendNum }).map(function (v) { return 0 }), Array.apply(null, { length: friendNumCombined }).map(function (v) { return 0 }))
    var airDamagedEnemyHp = new DamagedHpDto(Array.apply(null, { length: enemyNum }).map(function (v) { return 0 }), Array.apply(null, { length: enemyNumCombined }).map(function (v) { return 0 }))
    var supportDamagedFriendHp = new DamagedHpDto(Array.apply(null, { length: friendNum }).map(function (v) { return 0 }), Array.apply(null, { length: friendNumCombined }).map(function (v) { return 0 }))
    var supportDamagedEnemyHp = new DamagedHpDto(Array.apply(null, { length: enemyNum }).map(function (v) { return 0 }), Array.apply(null, { length: enemyNumCombined }).map(function (v) { return 0 }))
    var dayKind = null
    var nightKind = null
    var nightBattle1 = null
    var nightBattle2 = null
    var preAntiSubmarineAttack = null
    var preTorpedoAttack = null
    var dayBattle1 = null
    var dayBattle2 = null
    var dayBattle3 = null
    var torpedoAttack = null
    var nightBattle = null
    var dayFormation = null
    var nightFormation = null
    var nightTouchPlane = null
    var friendlyBattle = null
    var radarShooting = null
    var isBalloonCell = false
    // 航空戦フェーズ
    phaseList.forEach(function (phase) {
        // 航空戦全生成
        // 基地航空隊(噴式) -> 基地航空隊 -> 友軍艦隊(昼) -> 噴式強襲航空戦 -> 航空戦1 -> 航空戦2 -> 航空支援
        var airBattleList = [
            phase.airBaseInjection,                                                 // 基地航空隊(噴式)
            phase.support_kouku,                                                    // 友軍艦隊(昼)
            phase.airInjection,                                                     // 噴式強襲航空戦
            phase.air,                                                              // 航空戦1
            phase.air2,                                                             // 航空戦2
            { atacks: (phase.supportType === '航空支援' ? phase.support : null) },  // 航空支援
        ].concat(Java.from(phase.airBase))                                 // 基地航空隊
            // null除外
            .filter(function (battle) { return battle && battle.atacks })

        airBattleList.forEach(function (battle) {
            battle.atacks.forEach(function (atack) {
                Java.from(atack.damage).forEach(function (damage, i) {
                    if (atack.friendAtack) {
                        airDamagedEnemyHp[atack.target[i] < enemyNum ? 'main' : 'escort'][atack.target[i] % Math.max(6, enemyNum)] += damage
                    } else {
                        airDamagedFriendHp[atack.target[i] < friendNum ? 'main' : 'escort'][atack.target[i] % Math.max(6, friendNum)] += damage
                    }
                })
            })
        })
    })
    // 支援砲雷撃フェーズ
    phaseList.filter(function (phase) { return phase.supportType === '支援射撃' || phase.supportType === '支援長距離雷撃' }).map(function (phase) { return phase.support }).filter(function (support) { return support }).forEach(function (atacks) {
        atacks.forEach(function (atack) {
            Java.from(atack.damage).forEach(function (damage, i) {
                if (atack.friendAtack) {
                    supportDamagedEnemyHp[atack.target[i] < enemyNum ? 'main' : 'escort'][atack.target[i] % Math.max(6, enemyNum)] += damage
                } else {
                    supportDamagedFriendHp[atack.target[i] < friendNum ? 'main' : 'escort'][atack.target[i] % Math.max(6, friendNum)] += damage
                }
            })
        })
    })
    // 砲撃戦フェーズ
    var parseDay = function (phase, json) {
        if (json) {
            var result = []
            for (var idx in json.api_at_eflag) {
                var friendAttack = Number(json.api_at_eflag[idx]) === 0
                var attackType = json.api_at_type[idx]
                var showItem = json.api_si_list[idx]
                result[idx] = []
                for (var didx in json.api_df_list[idx]) {
                    var lastAttack = didx + 1 < json.api_df_list[idx].length ? Number(json.api_df_list[idx][didx + 1]) === -1 : true
                    if (Number(json.api_df_list[idx][didx]) !== -1) {
                        var attacker = function () {
                            switch (Number(attackType)) {
                                case 100: // Nelson Touch
                                    return didx * 2
                                case 101: // 一斉射かッ…胸が熱いな！
                                case 102: // 長門、いい？ いくわよ！ 主砲一斉射ッ！
                                case 401: // 第一戦隊、突撃！主砲、全力斉射ッ！
                                    return Math.floor(didx / 2)
                                case 103: // Colorado 特殊攻撃 ※正式名称不明
                                case 104: // 僚艦夜戦突撃
                                case 400: // 大和、突撃します！二番艦も続いてください！
                                    return didx
                                default:
                                    return json.api_at_list[idx]
                            }
                        }()
                        var defender = json.api_df_list[idx][didx]
                        var damage = Math.floor(json.api_damage[idx][didx])
                        var critical = json.api_cl_list[idx][didx]
                        if (friendAttack) {
                            result[idx][didx] = new AttackDto(phase.kind, friendAttack, attacker < friendNum, attacker % Math.max(6, friendNum), defender < enemyNum, defender % Math.max(6, enemyNum), lastAttack, damage, critical, attackType, showItem, didx)
                        } else {
                            result[idx][didx] = new AttackDto(phase.kind, friendAttack, attacker < enemyNum, attacker % Math.max(6, enemyNum), defender < friendNum, defender % Math.max(6, friendNum), lastAttack, damage, critical, attackType, showItem, didx)
                        }
                    }
                }
            }
            return result
        }
        return null
    }
    // 雷撃戦フェーズ
    var parseTorpedo = function (phase, atacks) {
        if (atacks) {
            var result = { friend: [], enemy: [] }
            var atackList = atacks.stream().collect(Collectors.partitioningBy(function (atack) { return atack.friendAtack }))
            Java.from(atackList.get(true)).forEach(function (atack, i) {
                result.friend[i] = []
                Java.from(atack.ot).forEach(function (x, j) {
                    result.friend[i][j] = new AttackDto(phase.kind, true, atack.origin[j] < friendNum, atack.origin[j] % Math.max(6, friendNum), atack.target[x] < enemyNum, atack.target[x] % Math.max(6, enemyNum), false, atack.ydam[j], atack.critical ? atack.critical[j] : 0, null, null, 0)
                })
            })
            Java.from(atackList.get(false)).forEach(function (atack, i) {
                result.enemy[i] = []
                Java.from(atack.ot).forEach(function (x, j) {
                    result.enemy[i][j] = new AttackDto(phase.kind, false, atack.origin[j] < enemyNum, atack.origin[j] % Math.max(6, enemyNum), atack.target[x] < friendNum, atack.target[x] % Math.max(6, friendNum), false, atack.ydam[j], atack.critical ? atack.critical[j] : 0, null, null, 0)
                })
            })
            return result
        }
        return null
    }
    // 夜戦フェーズ
    var parseNight = function (phase, json, friendMainAttack) {
        if (json) {
            var result = []
            for (var idx in json.api_at_eflag) {
                var friendAttack = Number(json.api_at_eflag[idx]) === 0
                var attackType = json.api_sp_list[idx]
                var showItem = json.api_si_list[idx]
                result[idx] = []
                for (var didx in json.api_df_list[idx]) {
                    var lastAttack = didx + 1 < json.api_df_list[idx].length ? Number(json.api_df_list[idx][didx + 1]) === -1 : true
                    if (Number(json.api_df_list[idx][didx]) !== -1) {
                        var attacker = function () {
                            switch (Number(attackType)) {
                                case 100: // Nelson Touch
                                    return didx * 2
                                case 101: // 一斉射かッ…胸が熱いな！
                                case 102: // 長門、いい？ いくわよ！ 主砲一斉射ッ！
                                case 401: // 第一戦隊、突撃！主砲、全力斉射ッ！
                                    return Math.floor(didx / 2)
                                case 103: // Colorado 特殊攻撃
                                case 104: // 僚艦夜戦突撃
                                case 400: // 大和、突撃します！二番艦も続いてください！
                                    return didx
                                default:
                                    return json.api_at_list[idx]
                            }
                        }()
                        var defender = json.api_df_list[idx][didx]
                        var damage = Math.floor(json.api_damage[idx][didx])
                        var critical = json.api_cl_list[idx][didx]
                        if (friendAttack) {
                            result[idx][didx] = new AttackDto(phase.kind, friendAttack, friendMainAttack, attacker % Math.max(6, friendNum), defender < enemyNum, defender % Math.max(6, enemyNum), lastAttack, damage, critical, attackType, showItem, didx)
                        } else {
                            result[idx][didx] = new AttackDto(phase.kind, friendAttack, attacker < enemyNum, attacker % Math.max(6, enemyNum), defender < friendNum, defender % Math.max(6, friendNum), lastAttack, damage, critical, attackType, showItem, didx)
                        }
                    }
                }
            }
            return result
        }
        return null
    }
    for (var idx in phaseList) {
        var phase = phaseList[idx]
        var json = phase.json
        var formation = Java.from(json.api_formation).map(Number)
        var activeDeck = json.api_active_deck
        var touchPlane = json.api_touch_plane
        isBalloonCell |= !!Number(json.api_balloon_cell)
        var friendMainAttack = !(activeDeck && Number(activeDeck[0]) === 2
            || [BattlePhaseKind.COMBINED_MIDNIGHT, BattlePhaseKind.COMBINED_SP_MIDNIGHT].indexOf(phase.kind) >= 0)
        if (!phase.isNight()) {
            dayFormation = formation
            dayKind = phase.kind
        } else {
            nightFormation = formation
            nightKind = phase.kind
            nightTouchPlane = json.api_touch_plane
        }
        // 払暁戦処理
        if (phase.kind === BattlePhaseKind.NIGHT_TO_DAY || phase.kind === BattlePhaseKind.COMBINED_EC_NIGHT_TO_DAY) {
            dayFormation = nightFormation = formation
            dayKind = nightKind = phase.kind
            nightTouchPlane = json.api_touch_plane
        }
        // 夜戦(払暁戦)1巡目
        nightBattle1 = nightBattle1 ? nightBattle1 : parseNight(phase, json.api_n_hougeki1, friendMainAttack)
        // 夜戦(払暁戦)2巡目
        nightBattle2 = nightBattle2 ? nightBattle2 : parseNight(phase, json.api_n_hougeki2, friendMainAttack)
        // 開幕対潜
        preAntiSubmarineAttack = preAntiSubmarineAttack ? preAntiSubmarineAttack : parseDay(phase, json.api_opening_taisen)
        // 開幕雷撃
        preTorpedoAttack = preTorpedoAttack ? preTorpedoAttack : parseTorpedo(phase, phase.opening)
        // 砲撃戦1巡目
        dayBattle1 = dayBattle1 ? dayBattle1 : parseDay(phase, json.api_hougeki1)
        // 砲撃戦2巡目
        dayBattle2 = dayBattle2 ? dayBattle2 : parseDay(phase, json.api_hougeki2)
        // 砲撃戦3巡目
        dayBattle3 = dayBattle3 ? dayBattle3 : parseDay(phase, json.api_hougeki3)
        // 雷撃戦
        torpedoAttack = torpedoAttack ? torpedoAttack : parseTorpedo(phase, phase.raigeki)
        // 友軍艦隊
        if (json.api_friendly_battle) {
            friendlyBattle = friendlyBattle ? friendlyBattle : parseNight(phase, json.api_friendly_battle.api_hougeki, friendMainAttack)
        }
        // 夜戦
        nightBattle = nightBattle ? nightBattle : parseNight(phase, json.api_hougeki, friendMainAttack)
        // レーダー射撃
        radarShooting = radarShooting ? radarShooting : parseDay(phase, json.api_hougeki1)
    }
    return new Battle(mapCell, dayKind, nightKind, friendCombinedKind, isEnemyCombined, dayFormation, nightFormation, nightTouchPlane, airDamagedFriendHp, airDamagedEnemyHp, supportDamagedFriendHp, supportDamagedEnemyHp, nightBattle1, nightBattle2, preAntiSubmarineAttack, preTorpedoAttack, dayBattle1, dayBattle2, dayBattle3, torpedoAttack, nightBattle, friendlyBattle, isBalloonCell)
}

/**
 * 攻撃
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {Boolean} friendAttack 味方の攻撃か
 * @param {Boolean} mainAttack 攻撃側が主力か
 * @param {Number} attacker 攻撃側index
 * @param {Boolean} mainDefense 防御側が主力か
 * @param {Number} defender 防御側index
 * @param {Boolean} lastAttack 最後の攻撃か(連撃2回目など)
 * @param {Number} damage ダメージ
 * @param {Number} critical クリティカル
 * @param {Number} attackType 特殊攻撃フラグ
 * @param {[Number|String]} showItem 表示装備
 * @param {Number} attackIndex 攻撃回数
 */
var AttackDto = function (kind, friendAttack, mainAttack, attacker, mainDefense, defender, lastAttack, damage, critical, attackType, showItem, attackIndex) {
    this.kind = kind
    this.friendAttack = friendAttack
    this.mainAttack = mainAttack
    this.attacker = attacker
    this.mainDefense = mainDefense
    this.defender = defender
    this.lastAttack = lastAttack
    this.damage = damage
    this.critical = critical
    this.attackType = attackType
    this.showItem = showItem
    this.attackIndex = attackIndex
}

/**
 * 戦闘
 * @param {logbook.dto.MapCellDto} mapCell マップ
 * @param {logbook.dto.BattlePhaseKind} dayKind 昼戦:戦闘の種類
 * @param {logbook.dto.BattlePhaseKind} nightKind 夜戦:戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {[number,number,number]} dayFormation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {[number,number,number]} nightFormation 夜戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {[Number,Number]} nightTouchPlane 夜間触接
 * @param {DamagedHpDto} airDamagedFriendHp 自艦隊が受けた全航空戦の被害Hp量
 * @param {DamagedHpDto} airDamagedEnemyHp 敵艦隊が受けた全航空戦の被害Hp量
 * @param {DamagedHpDto} supportDamagedFriendHp 自艦隊が受けた支援砲雷撃の被害Hp量
 * @param {DamagedHpDto} supportDamagedEnemyHp 敵艦隊が受けた支援砲雷撃の被害Hp量
 * @param {[AttackDto]} nightBattle1 夜戦1
 * @param {[AttackDto]} nightBattle2 夜戦2
 * @param {[AttackDto]} preAntiSubmarineAttack 先制対潜
 * @param {[AttackDto]} preTorpedoAttack 先制雷撃
 * @param {[AttackDto]} dayBattle1 砲撃戦1
 * @param {[AttackDto]} dayBattle2 砲撃戦2
 * @param {[AttackDto]} dayBattle3 砲撃戦3
 * @param {[AttackDto]} torpedoAttack 雷撃戦
 * @param {[AttackDto]} nightBattle 夜戦
 * @param {[AttackDto]} friendlyBattle 友軍艦隊
 * @param {Boolean} isBalloonCell 阻塞気球発動可能マスか
 */
var Battle = function (mapCell, dayKind, nightKind, friendCombinedKind, isEnemyCombined, dayFormation, nightFormation, nightTouchPlane, airDamagedFriendHp, airDamagedEnemyHp, supportDamagedFriendHp, supportDamagedEnemyHp, nightBattle1, nightBattle2, preAntiSubmarineAttack, preTorpedoAttack, dayBattle1, dayBattle2, dayBattle3, torpedoAttack, nightBattle, friendlyBattle, isBalloonCell) {
    this.mapCell = mapCell
    this.dayKind = dayKind
    this.nightKind = nightKind
    this.friendCombinedKind = friendCombinedKind
    this.isEnemyCombined = isEnemyCombined
    this.dayFormation = dayFormation
    this.nightFormation = nightFormation
    this.nightTouchPlane = nightTouchPlane
    this.airDamagedFriendHp = airDamagedFriendHp
    this.airDamagedEnemyHp = airDamagedEnemyHp
    this.supportDamagedFriendHp = supportDamagedFriendHp
    this.supportDamagedEnemyHp = supportDamagedEnemyHp
    this.nightBattle1 = nightBattle1
    this.nightBattle2 = nightBattle2
    this.preAntiSubmarineAttack = preAntiSubmarineAttack
    this.preTorpedoAttack = preTorpedoAttack
    this.dayBattle1 = dayBattle1
    this.dayBattle2 = dayBattle2
    this.dayBattle3 = dayBattle3
    this.torpedoAttack = torpedoAttack
    this.nightBattle = nightBattle
    this.friendlyBattle = friendlyBattle
    this.isBalloonCell = isBalloonCell
}

//#endregion

//#region 検知処理

/**
 * 検知処理
 * 検知されなかった場合、Comparable[3]={null,null,null}を返す
 * @param {java.util.Date} date 戦闘日時
 * @param {Battle} battle 戦闘データ
 * @param {FleetDto} friends 自艦隊情報
 * @param {FleetDto} enemies 敵艦隊情報
 * @param {FleetHpDto} friendHp 自艦隊Hp
 * @param {FleetHpDto} enemyHp 敵艦隊Hp
 * @return {java.lang.Comparable[]} 拡張版で表示する部分
 */
var detectOrDefault = function (date, battle, friends, enemies, friendHp, enemyHp) {
    var ret = new ComparableArrayType(3)
    var dayBattle = []
    var torpedoAttack = []
    var nightBattle = []
    // 航空戦ダメージ処理
    var airBattle = function () {
        for (var i in battle.airDamagedFriendHp.main) {
            friendHp.main[i].now -= battle.airDamagedFriendHp.main[i]
            damageControl(friendHp.main[i], friends.main.get(i))
        }
        for (var i in battle.airDamagedFriendHp.escort) {
            friendHp.escort[i].now -= battle.airDamagedFriendHp.escort[i]
            damageControl(friendHp.escort[i], friends.escort.get(i))
        }
        // ダメコン処理は省略
        for (var i in battle.airDamagedEnemyHp.main) {
            enemyHp.main[i].now -= battle.airDamagedEnemyHp.main[i]
        }
        for (var i in battle.airDamagedEnemyHp.escort) {
            enemyHp.escort[i].now -= battle.airDamagedEnemyHp.escort[i]
        }
    }
    // 支援砲雷撃ダメージ処理
    var supportAttack = function () {
        for (var i in battle.supportDamagedFriendHp.main) {
            friendHp.main[i].now -= battle.supportDamagedFriendHp.main[i]
            damageControl(friendHp.main[i], friends.main.get(i))
        }
        for (var i in battle.supportDamagedFriendHp.escort) {
            friendHp.escort[i].now -= battle.supportDamagedFriendHp.escort[i]
            damageControl(friendHp.escort[i], friends.escort.get(i))
        }
        // ダメコン処理は省略
        for (var i in battle.supportDamagedEnemyHp.main) {
            enemyHp.main[i].now -= battle.supportDamagedEnemyHp.main[i]
        }
        for (var i in battle.supportDamagedEnemyHp.escort) {
            enemyHp.escort[i].now -= battle.supportDamagedEnemyHp.escort[i]
        }
    }
    // 友軍艦隊
    var friendlyBattle = function () {
        if (battle.friendlyBattle) {
            battle.friendlyBattle.forEach(function (attacks) {
                attacks.filter(function (attack) {
                    // ダメージ=0を判定しても無駄なので除外
                    return Math.floor(attack.damage) > 0
                }).filter(function (attack) {
                    // 味方艦隊への誤爆排除
                    return attack.friendAttack
                }).forEach(function (attack) {
                    var ship = extractInvolvedShips(attack, friends, enemies)
                    var hp = extractInvolvedShipHps(attack, friendHp, enemyHp)
                    damageHandling(ship.defender, hp.defender, attack.damage, attack.lastAttack) // ダメージ処理
                })
            })
        }
    }
    var unexpected = getData("unexpected")
    // 戦闘処理
    switch (battle.dayKind) {
        case BattlePhaseKind.BATTLE:                                                                                                                                                                                                                                                                                  // ・昼戦(通常vs通常,6対6)
        case BattlePhaseKind.COMBINED_BATTLE_WATER:                                                                                                                                                                                                                                                                   // ・昼戦(水上vs通常,12対6)
        case BattlePhaseKind.COMBINED_EACH_BATTLE_WATER:                                                                                                                                                                                                                                                              // ・昼戦(水上vs連合,12対12)
            airBattle()                                                                                                                                                                                                                                                                                               // ├航空戦
            supportAttack()                                                                                                                                                                                                                                                                                           // ├支援砲雷撃
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.preAntiSubmarineAttack, friends, enemies, friendHp, enemyHp, false, battle.isBalloonCell, unexpected))                         // ├先制対潜
            Array.prototype.push.apply(torpedoAttack, detectTorpedoAttack(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.preTorpedoAttack, friends, enemies, friendHp, enemyHp, battle.isBalloonCell, unexpected))                              // ├先制雷撃
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.dayBattle1, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                                      // ├砲撃戦1巡目
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.dayBattle2, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                                      // ├砲撃戦2巡目
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.dayBattle3, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                                      // ├砲撃戦3巡目
            Array.prototype.push.apply(torpedoAttack, detectTorpedoAttack(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.torpedoAttack, friends, enemies, friendHp, enemyHp, battle.isBalloonCell, unexpected))                                 // ├雷撃戦
            friendlyBattle()                                                                                                                                                                                                                                                                                          // ├友軍艦隊
            Array.prototype.push.apply(nightBattle, detectNightBattle(date, battle.mapCell, battle.nightKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.nightFormation, battle.nightTouchPlane, battle.nightBattle, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))     // └夜戦
            break
        case BattlePhaseKind.COMBINED_EACH_BATTLE:                                                                                                                                                                                                                                                                    // ・昼戦(機動or輸送vs連合,12対12)
            airBattle()                                                                                                                                                                                                                                                                                               // ├航空戦
            supportAttack()                                                                                                                                                                                                                                                                                           // ├支援砲雷撃
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.preAntiSubmarineAttack, friends, enemies, friendHp, enemyHp, false, battle.isBalloonCell, unexpected))                         // ├先制対潜
            Array.prototype.push.apply(torpedoAttack, detectTorpedoAttack(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.preTorpedoAttack, friends, enemies, friendHp, enemyHp, battle.isBalloonCell, unexpected))                              // ├先制雷撃
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.dayBattle1, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                                      // ├砲撃戦1巡目
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.dayBattle2, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                                      // ├砲撃戦2巡目
            Array.prototype.push.apply(torpedoAttack, detectTorpedoAttack(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.torpedoAttack, friends, enemies, friendHp, enemyHp, battle.isBalloonCell, unexpected))                                 // ├雷撃戦
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.dayBattle3, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                                      // ├砲撃戦3巡目
            friendlyBattle()                                                                                                                                                                                                                                                                                          // ├友軍艦隊
            Array.prototype.push.apply(nightBattle, detectNightBattle(date, battle.mapCell, battle.nightKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.nightFormation, battle.nightTouchPlane, battle.nightBattle, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))     // └夜戦
            break
        case BattlePhaseKind.COMBINED_BATTLE:                                                                                                                                                                                                                                                                         // ・昼戦(機動or輸送vs通常,12対6)
        case BattlePhaseKind.COMBINED_EC_BATTLE:                                                                                                                                                                                                                                                                      // ・昼戦(通常vs連合,6対12)
            airBattle()                                                                                                                                                                                                                                                                                               // ├航空戦
            supportAttack()                                                                                                                                                                                                                                                                                           // ├支援砲雷撃
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.preAntiSubmarineAttack, friends, enemies, friendHp, enemyHp, false, battle.isBalloonCell, unexpected))                         // ├先制対潜
            Array.prototype.push.apply(torpedoAttack, detectTorpedoAttack(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.preTorpedoAttack, friends, enemies, friendHp, enemyHp, battle.isBalloonCell, unexpected))                              // ├先制雷撃
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.dayBattle1, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                                      // ├砲撃戦1巡目
            Array.prototype.push.apply(torpedoAttack, detectTorpedoAttack(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.torpedoAttack, friends, enemies, friendHp, enemyHp, battle.isBalloonCell, unexpected))                                 // ├雷撃戦
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.dayBattle2, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                                      // ├砲撃戦2巡目
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.dayBattle3, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                                      // ├砲撃戦3巡目
            friendlyBattle()                                                                                                                                                                                                                                                                                          // ├友軍艦隊
            Array.prototype.push.apply(nightBattle, detectNightBattle(date, battle.mapCell, battle.nightKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.nightFormation, battle.nightTouchPlane, battle.nightBattle, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))     // └夜戦
            break
        case BattlePhaseKind.NIGHT_TO_DAY:                                                                                                                                                                                                                                                                            // ・払暁戦(通常vs通常,6対6)
        case BattlePhaseKind.COMBINED_EC_NIGHT_TO_DAY:                                                                                                                                                                                                                                                                // ・払暁戦(通常vs連合,6対12)
            supportAttack()                                                                                                                                                                                                                                                                                           // ├支援砲雷撃
            friendlyBattle()                                                                                                                                                                                                                                                                                          // ├友軍艦隊
            Array.prototype.push.apply(nightBattle, detectNightBattle(date, battle.mapCell, battle.nightKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.nightFormation, battle.nightTouchPlane, battle.nightBattle1, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))    // ├夜戦1巡目
            Array.prototype.push.apply(nightBattle, detectNightBattle(date, battle.mapCell, battle.nightKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.nightFormation, battle.nightTouchPlane, battle.nightBattle2, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))    // ├夜戦2巡目
            airBattle()                                                                                                                                                                                                                                                                                               // ├航空戦
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.preAntiSubmarineAttack, friends, enemies, friendHp, enemyHp, false, battle.isBalloonCell, unexpected))                         // ├先制対潜
            Array.prototype.push.apply(torpedoAttack, detectTorpedoAttack(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.preTorpedoAttack, friends, enemies, friendHp, enemyHp, battle.isBalloonCell, unexpected))                              // ├先制雷撃
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.dayBattle1, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                                      // ├砲撃戦1巡目
            Array.prototype.push.apply(dayBattle, detectDayBattle(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.dayBattle2, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                                      // ├砲撃戦2巡目
            Array.prototype.push.apply(torpedoAttack, detectTorpedoAttack(date, battle.mapCell, battle.dayKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.dayFormation, battle.torpedoAttack, friends, enemies, friendHp, enemyHp, battle.isBalloonCell, unexpected))                                 // └雷撃戦
            break
        case BattlePhaseKind.LD_SHOOTING:                                                                                                                                                                                                                                                                             //  ・レーダー射撃戦(通常vs通常,6対6)
        case BattlePhaseKind.COMBINED_LD_SHOOTING:                                                                                                                                                                                                                                                                    //  ・レーダー射撃戦(通常vs連合,12対6)
            airBattle()                                                                                                                                                                                                                                                                                               // ├航空戦
            Array.prototype.push.apply(nightBattle, detectRadarShooting(date, battle.mapCell, battle.nightKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.nightFormation, battle.radarShooting, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))                         // └レーダー射撃
            break
        default:
            break
    }
    if (battle.nightKind === BattlePhaseKind.SP_MIDNIGHT) {                                                                                                                                                                                                                                                           // ・開幕夜戦(通常vs通常,6対6)
        supportAttack()                                                                                                                                                                                                                                                                                               // ├支援砲雷撃
        friendlyBattle()                                                                                                                                                                                                                                                                                              // ├友軍艦隊
        Array.prototype.push.apply(nightBattle, detectNightBattle(date, battle.mapCell, battle.nightKind, battle.friendCombinedKind, battle.isEnemyCombined, battle.nightFormation, battle.nightTouchPlane, battle.nightBattle, friends, enemies, friendHp, enemyHp, true, battle.isBalloonCell, unexpected))         // └夜戦
    }

    /**
     * 想定値誤差ソート用
     * @param {DetectDto} data1 データ1
     * @param {DetectDto} data2 データ2
     */
    function errorDescending(data1, data2) {
        var armor1 = Math.max(data1.defender.soukou + getArmorBonus(data1.date, data1.mapCell, data1.attacker, data1.defender), 1)
        var minDef1 = armor1 * 0.7
        var maxDef1 = armor1 * 0.7 + Math.floor(armor1 - 1) * 0.6
        var minDmg1 = Math.floor((data1.power[0] - maxDef1) * getAmmoBonus(data1.attacker, data1.origins, data1.mapCell))
        var maxDmg1 = Math.floor((data1.power[1] - minDef1) * getAmmoBonus(data1.attacker, data1.origins, data1.mapCell))
        var diff1 = Math.abs(data1.attack.damage - (data1.attack.damage < minDmg1 ? minDmg1 : maxDmg1))
        var armor2 = Math.max(data2.defender.soukou + getArmorBonus(data2.date, data2.mapCell, data2.attacker, data2.defender), 1)
        var minDef2 = armor2 * 0.7
        var maxDef2 = armor2 * 0.7 + Math.floor(armor2 - 1) * 0.6
        var minDmg2 = Math.floor((data2.power[0] - maxDef2) * getAmmoBonus(data2.attacker, data2.origins, data2.mapCell))
        var maxDmg2 = Math.floor((data2.power[1] - minDef2) * getAmmoBonus(data2.attacker, data2.origins, data2.mapCell))
        var diff2 = Math.abs(data2.attack.damage - (data2.damage < minDmg2 ? minDmg2 : maxDmg2))
        return diff2 - diff1
    }

    setTmpData(date, [dayBattle, torpedoAttack, nightBattle])

    setTmpData("unexpected", unexpected)

    ret[0] = toDispString(dayBattle.sort(errorDescending)[0])
    ret[1] = toDispString(torpedoAttack.sort(errorDescending)[0])
    ret[2] = toDispString(nightBattle.sort(errorDescending)[0])
    return ret
}

/**
 * 拡張版に表示用の文字列を返します。
 * @param {DetectDto} data 検知
 * @return {String} 表示用の文字列
 */
function toDispString(data) {
    if (data !== undefined) {
        var armor = Math.max(data.defender.soukou + getArmorBonus(data.date, data.mapCell, data.attacker, data.defender), 1)
        var minDef = armor * 0.7
        var maxDef = armor * 0.7 + Math.floor(armor - 1) * 0.6
        var minDmg = Math.floor((data.power[0] - maxDef) * getAmmoBonus(data.attacker, data.origins, data.mapCell))
        var maxDmg = Math.floor((data.power[1] - minDef) * getAmmoBonus(data.attacker, data.origins, data.mapCell))
        var diff = (data.attack.damage < minDmg ? "" : "+") + (data.attack.damage - (data.attack.damage < minDmg ? minDmg : maxDmg))
        return String((data.attack.attacker + 1) + ":" + data.attacker.friendlyName.replace(/\(.*\)$/, "") + "[HP:" + data.attackerHp.now + "/" + data.attackerHp.max + "]→" + (data.attack.defender + 1) + ":" + data.defender.friendlyName.replace(/\(.*\)$/, "") + "[HP:" + data.defenderHp.now + "→" + (data.defenderHp.now - data.attack.damage) + "/" + data.defenderHp.max + "] dmg:" + Math.floor(data.attack.damage) + " 理論値->" + minDmg + "～" + maxDmg + " 想定:" + diff)
    }
    return ""
}

/**
 * ダメコン処理
 * 今のところ艦娘使用が前提のため装備削除はしていないが、
 * 敵もしてくるようになったら削除予定
 * @param {ShipHpDto} shipHp 艦Hp
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} ship 艦ステータス
 */
var damageControl = function (shipHp, ship) {
    if (shipHp.isSunkDamage()) {
        var items = getItems(ship)
        items.some(function (item) {
            switch (item.slotitemId) {
                case 42: // 応急修理要員
                    shipHp.now = Math.floor(shipHp.max * 0.2)
                    return true
                case 43: // 応急修理女神
                    shipHp.now = shipHp.max
                    return true
            }
            return false
        })
    }
}

/**
 * 検知
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.MapCellDto} mapCell マップ
 * @param {Number} phase 0:昼砲撃戦、1:昼雷撃戦、2:夜戦
 * @param {AttackDto} attack 攻撃
 * @param {[Number,Number]} power 火力
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} attacker 攻撃艦
 * @param {logbook.dto.ShipDto|logbook.dto.EnemyShipDto} defender 防御艦
 * @param {ShipHpDto} attackerHp 攻撃艦Hp
 * @param {ShipHpDto} defenderHp 防御艦Hp
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {[Number,Number]} touchPlane 夜間触接
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか(default=true)
 * @param {FleetDto} origins 攻撃側艦隊
 * @param {Boolean} isRadarShooting レーダー射撃戦か(default=false)
 * @param {Boolean} isBalloonCell 阻塞気球発動可能マスか
 * @param {{min: Number, max:Number, minEx:Number, maxEx:Number, date:Number}} inversion 逆算
 */
var DetectDto = function (date, mapCell, phase, attack, power, attacker, defender, attackerHp, defenderHp, kind, friendCombinedKind, isEnemyCombined, formation, touchPlane, shouldUseSkilled, origins, isRadarShooting, inversion, isBalloonCell) {
    this.date = date
    this.mapCell = mapCell
    this.phase = phase
    this.attack = attack
    this.power = power
    this.attacker = attacker
    this.defender = defender
    this.attackerHp = attackerHp.copy()
    this.defenderHp = defenderHp.copy()
    this.kind = kind
    this.friendCombinedKind = friendCombinedKind
    this.isEnemyCombined = isEnemyCombined
    this.formation = formation
    this.touchPlane = touchPlane
    this.shouldUseSkilled = shouldUseSkilled
    this.origins = origins
    this.isRadarShooting = !!isRadarShooting
    this.inversion = inversion
    this.numOfAttackShips = origins[attack.mainAttack ? "main" : "escort"].length
    this.isBalloonCell = isBalloonCell
}

/**
 * 砲撃戦検知
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.MapCellDto} mapCell マップ
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {[[AttackDto]]} attackList 攻撃リスト
 * @param {FleetDto} friends 自艦隊データ
 * @param {FleetDto} enemies 敵艦隊データ
 * @param {FleetHpDto} friendHp 自艦隊Hp
 * @param {FleetHpDto} enemyHp 敵艦隊Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか(default=true)
 * @param {Boolean} isBalloonCell 阻塞気球発動可能マスか
 * @param {{}} unexpected 異常ダメージデータ
 * @return {[DetectDto]} 異常データ
 */
var detectDayBattle = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, formation, attackList, friends, enemies, friendHp, enemyHp, shouldUseSkilled, isBalloonCell, unexpected) {
    var result = []
    if (attackList) {
        attackList.forEach(function (attacks) {
            attacks.filter(function (attack) {
                // 攻撃ミスは除外
                return (attack.critical | 0) > 0
            }).forEach(function (attack) {
                var ship = extractInvolvedShips(attack, friends, enemies)
                var numOfAttackShips = (attack.friendAttack ? friendHp : enemyHp)[attack.mainAttack ? "main" : "escort"].length
                var hp = extractInvolvedShipHps(attack, friendHp, enemyHp)
                // 味方潜水への攻撃は検出対象から除外(敵対潜値が不明のため)
                if (!(!attack.friendAttack && isSubMarine(ship.defender))) {
                    // 特殊攻撃は熟練度の対象から外す
                    var _shouldUseSkilled = shouldUseSkilled && attack.attackType < 100
                    var origins = attack.friendAttack ? friends : enemies
                    var p = getDayBattlePower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, ship.attacker, ship.defender, hp.attacker, _shouldUseSkilled, attack.friendAttack ? friends : enemies, isBalloonCell)
                    var power = p.getPostcapPower()
                    var armor = Math.max(ship.defender.soukou + getArmorBonus(date, mapCell, ship.attacker, ship.defender), 1)
                    var minDef = armor * 0.7
                    var maxDef = armor * 0.7 + Math.floor(armor - 1) * 0.6
                    var minDmg = Math.floor((power[0] - maxDef) * getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell))
                    var maxDmg = Math.floor((power[1] - minDef) * getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell))
                    var minPropDmg = Math.floor(hp.defender.now * 0.06)
                    var maxPropDmg = Math.max(Math.floor(hp.defender.now * 0.14 - 0.08), 0) // オーバーキル用
                    var minSunkDmg = Math.floor(hp.defender.now * 0.5)
                    var maxSunkDmg = Math.floor(hp.defender.now * 0.8 - 0.3)
                    var redCondDying = isHp1ReplacementShip(ship.defender, attack.defender === 0) && ((hp.defender.now - attack.damage) === 1)
                    var covered = minPropDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxPropDmg || !attack.friendAttack && (minSunkDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxSunkDmg || redCondDying)
                    if (!(minDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxDmg || covered)) {
                        var ammoBonus = getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell)
                        // キャップ後攻撃力(最小) = ダメージ / 弾薬補正 + 装甲乱数(最小)
                        var minPostcapPower = attack.damage / ammoBonus + minDef
                        // キャップ後攻撃力(最大) = (ダメージ + 1) / 弾薬補正 + 装甲乱数(最大)
                        var maxPostcapPower = (attack.damage + 1) / ammoBonus + maxDef
                        var inversion = {
                            min: minPostcapPower / power[1],
                            max: maxPostcapPower / power[0],
                            date: date.getTime()
                        }
                        // 熟練度
                        var skilled = getSkilledBonus(date, attack, ship.attacker, ship.defender, hp.attacker)
                        if (mapCell.map[0] >= 22 && attack.friendAttack) {
                            // 割合ダメージ等ではない&(敵が陸上型またはPT小鬼群または熟練度補正攻撃ではない)
                            if (!covered && !(isGround(ship.defender) || isPtImpPack(ship.defender) || skilled[0] > 1)) {
                                var maps = JSON.stringify(Java.from(mapCell.map))
                                var index = ship.attacker.shipId + "_" + ship.attacker.friendlyName.replace(/\(.*\)$/, "") + "_" + ship.defender.shipId + "_" + ship.defender.friendlyName.replace(/\(.*\)$/, "")

                                if (!unexpected[maps]) {
                                    unexpected[maps] = {}
                                }
                                if (!unexpected[maps][index]) {
                                    unexpected[maps][index] = []
                                }
                                unexpected[maps][index].push(inversion)
                            }
                        }
                        result.push(new DetectDto(date, mapCell, 0, attack, power, ship.attacker, ship.defender, hp.attacker, hp.defender, kind, friendCombinedKind, isEnemyCombined, formation, [-1, -1], _shouldUseSkilled, origins, false, inversion, isBalloonCell))
                    }
                }
                damageHandling(ship.defender, hp.defender, attack.damage, attack.lastAttack) // ダメージ処理
            })
        })
    }
    return result
}

/**
 * 雷撃戦検知
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.MapCellDto} mapCell マップ
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {{friend:[AttackDto],enemy:[AttackDto]}} attackList 攻撃リスト
 * @param {FleetDto} friends 自艦隊データ
 * @param {FleetDto} enemies 敵艦隊データ
 * @param {FleetHpDto} friendHp 自艦隊Hp
 * @param {FleetHpDto} enemyHp 敵艦隊Hp
 * @param {Boolean} isBalloonCell 阻塞気球発動可能マスか
 * @param {{}} unexpected 異常ダメージデータ
 * @return {[DetectDto]} 異常データ
 */
var detectTorpedoAttack = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, formation, attackList, friends, enemies, friendHp, enemyHp, isBalloonCell, unexpected) {
    var result = []
    if (attackList) {
        // 仮作成(無理やり作成)
        var fFriendHp = new FleetHpDto(friendHp.main.map(function (hp) { return new ShipHpDto(hp.max, hp.start, hp.now) }), friendHp.escort.map(function (hp) { return new ShipHpDto(hp.max, hp.start, hp.now) }))
        var fEnemyHp = new FleetHpDto(enemyHp.main.map(function (hp) { return new ShipHpDto(hp.max, hp.start, hp.now) }), enemyHp.escort.map(function (hp) { return new ShipHpDto(hp.max, hp.start, hp.now) }))
        var eFriendHp = new FleetHpDto(friendHp.main.map(function (hp) { return new ShipHpDto(hp.max, hp.start, hp.now) }), friendHp.escort.map(function (hp) { return new ShipHpDto(hp.max, hp.start, hp.now) }))
        var eEnemyHp = new FleetHpDto(enemyHp.main.map(function (hp) { return new ShipHpDto(hp.max, hp.start, hp.now) }), enemyHp.escort.map(function (hp) { return new ShipHpDto(hp.max, hp.start, hp.now) }))

        Array.prototype.concat.apply([], attackList.friend).filter(function (attack) {
            // 攻撃ミスは除外
            return (attack.critical | 0) > 0
        }).forEach(function (attack) {
            var ship = extractInvolvedShips(attack, friends, enemies)
            var numOfAttackShips = (attack.friendAttack ? friendHp : enemyHp)[attack.mainAttack ? "main" : "escort"].length
            var hp = extractInvolvedShipHps(attack, fFriendHp, fEnemyHp)
            var power = getTorpedoPower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, ship.attacker, ship.defender, hp.attacker).getPostcapPower()
            var armor = Math.max(ship.defender.soukou + getArmorBonus(date, mapCell, ship.attacker, ship.defender), 1)
            var minDef = armor * 0.7
            var maxDef = armor * 0.7 + Math.floor(armor - 1) * 0.6
            var minDmg = Math.floor((power[0] - maxDef) * getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell))
            var maxDmg = Math.floor((power[1] - minDef) * getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell))
            var minPropDmg = Math.floor(hp.defender.now * 0.06)
            var maxPropDmg = Math.max(Math.floor(hp.defender.now * 0.14 - 0.08), 0) // オーバーキル用
            var covered = minPropDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxPropDmg
            if (!(minDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxDmg || covered)) {
                var ammoBonus = getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell)
                // キャップ後攻撃力(最小) = ダメージ / 弾薬補正 + 装甲乱数(最小)
                var minPostcapPower = attack.damage / ammoBonus + minDef
                // キャップ後攻撃力(最大) = (ダメージ + 1) / 弾薬補正 + 装甲乱数(最大)
                var maxPostcapPower = (attack.damage + 1) / ammoBonus + maxDef
                var inversion = {
                    min: minPostcapPower / power[1],
                    max: maxPostcapPower / power[0],
                    date:date.getTime()
                }

                if (mapCell.map[0] >= 22) {
                    // 割合ダメージ等ではない&(敵がPT小鬼群ではない)
                    if (!covered && !isPtImpPack(ship.defender)) {
                        var maps = JSON.stringify(Java.from(mapCell.map))
                        var index = ship.attacker.shipId + "_" + ship.attacker.friendlyName.replace(/\(.*\)$/, "") + "_" + ship.defender.shipId + "_" + ship.defender.friendlyName.replace(/\(.*\)$/, "")

                        if (!unexpected[maps]) {
                            unexpected[maps] = {}
                        }
                        if (!unexpected[maps][index]) {
                            unexpected[maps][index] = []
                        }
                        unexpected[maps][index].push(inversion)
                    }
                }
                result.push(new DetectDto(date, mapCell, 1, attack, power, ship.attacker, ship.defender, hp.attacker, hp.defender, kind, friendCombinedKind, isEnemyCombined, formation, [-1, -1], false, friends, false, inversion, isBalloonCell))
            }
            damageHandling(ship.defender, hp.defender, attack.damage, false) // ダメージ仮処理
        })

        Array.prototype.concat.apply([], attackList.enemy).filter(function (attack) {
            // 攻撃ミスは除外
            return (attack.critical | 0) > 0
        }).forEach(function (attack) {
            var ship = extractInvolvedShips(attack, friends, enemies)
            var numOfAttackShips = (attack.friendAttack ? friendHp : enemyHp)[attack.mainAttack ? "main" : "escort"].length
            var hp = extractInvolvedShipHps(attack, eFriendHp, eEnemyHp)
            var power = getTorpedoPower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, ship.attacker, ship.defender, hp.attacker).getPostcapPower()
            var armor = Math.max(ship.defender.soukou + getArmorBonus(date, mapCell, ship.attacker, ship.defender), 1)
            var minDef = armor * 0.7
            var maxDef = armor * 0.7 + Math.floor(armor - 1) * 0.6
            var minDmg = Math.floor((power[0] - maxDef) * getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell))
            var maxDmg = Math.floor((power[1] - minDef) * getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell))
            var minPropDmg = Math.floor(hp.defender.now * 0.06)
            var maxPropDmg = Math.max(Math.floor(hp.defender.now * 0.14 - 0.08), 0) // オーバーキル用
            var minSunkDmg = Math.floor(hp.defender.now * 0.5)
            var maxSunkDmg = Math.floor(hp.defender.now * 0.8 - 0.3)
            var redCondDying = isHp1ReplacementShip(ship.defender, attack.defender === 0) && ((hp.defender.now - attack.damage) === 1)
            var covered = minPropDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxPropDmg || minSunkDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxSunkDmg || redCondDying
            if (!(minDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxDmg || covered)) {
                var ammoBonus = getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell)
                // キャップ後攻撃力(最小) = ダメージ / 弾薬補正 + 装甲乱数(最小)
                var minPostcapPower = attack.damage / ammoBonus + minDef
                // キャップ後攻撃力(最大) = (ダメージ + 1) / 弾薬補正 + 装甲乱数(最大)
                var maxPostcapPower = (attack.damage + 1) / ammoBonus + maxDef
                var inversion = {
                    min: minPostcapPower / power[1],
                    max: maxPostcapPower / power[0],
                    date:date.getTime()
                }

                result.push(new DetectDto(date, mapCell, 1, attack, power, ship.attacker, ship.defender, hp.attacker, hp.defender, kind, friendCombinedKind, isEnemyCombined, formation, [-1, -1], false, enemies, false, inversion, isBalloonCell))
            }
            damageHandling(ship.defender, hp.defender, attack.damage, false) // ダメージ仮処理
        })

        Array.prototype.concat.apply([], attackList.friend.concat(attackList.enemy)).filter(function (attack) {
            // ダメージ=0を判定しても無駄なので除外
            return Math.floor(attack.damage) > 0
        }).forEach(function (attack) {
            var ship = extractInvolvedShips(attack, friends, enemies)
            var hp = extractInvolvedShipHps(attack, friendHp, enemyHp)
            damageHandling(ship.defender, hp.defender, attack.damage, false) // ダメージ本処理
        })

        // ダメコン処理
        friendHp.main.forEach(function (hp, i) {
            damageControl(hp, friends.main.get(i))
        })
        friendHp.escort.forEach(function (hp, i) {
            damageControl(hp, friends.escort.get(i))
        })
        enemyHp.main.forEach(function (hp, i) {
            damageControl(hp, enemies.main.get(i))
        })
        enemyHp.escort.forEach(function (hp, i) {
            damageControl(hp, enemies.escort.get(i))
        })
    }
    return result
}

/**
 * 夜戦検知
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.MapCellDto} mapCell マップ
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {[Number,Number]} touchPlane 夜間触接
 * @param {[[AttackDto]]} attackList 攻撃リスト
 * @param {FleetDto} friends 自艦隊データ
 * @param {FleetDto} enemies 敵艦隊データ
 * @param {FleetHpDto} friendHp 自艦隊Hp
 * @param {FleetHpDto} enemyHp 敵艦隊Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか(default=true)
 * @param {Boolean} isBalloonCell 阻塞気球発動可能マスか
 * @param {{}} unexpected 異常ダメージデータ
 * @return {[DetectDto]} 異常データ
 */
var detectNightBattle = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, formation, touchPlane, attackList, friends, enemies, friendHp, enemyHp, shouldUseSkilled, isBalloonCell, unexpected) {
    var result = []
    if (attackList) {
        attackList.forEach(function (attacks) {
            attacks.filter(function (attack) {
                // 攻撃ミスは除外
                return (attack.critical | 0) > 0
            }).forEach(function (attack) {
                var ship = extractInvolvedShips(attack, friends, enemies)
                var numOfAttackShips = (attack.friendAttack ? friendHp : enemyHp)[attack.mainAttack ? "main" : "escort"].length
                var hp = extractInvolvedShipHps(attack, friendHp, enemyHp)
                // 味方潜水への攻撃は検出対象から除外(敵対潜値が不明のため)
                if (!(!attack.friendAttack && isSubMarine(ship.defender))) {
                    // 特殊攻撃は熟練度の対象から外す
                    var _shouldUseSkilled = shouldUseSkilled && attack.attackType < 100
                    var origins = attack.friendAttack ? friends : enemies
                    var power = getNightBattlePower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, touchPlane, attack, ship.attacker, ship.defender, hp.attacker, _shouldUseSkilled, attack.friendAttack ? friends : enemies).getPostcapPower()
                    var armor = Math.max(ship.defender.soukou + getArmorBonus(date, mapCell, ship.attacker, ship.defender), 1)
                    var minDef = armor * 0.7
                    var maxDef = armor * 0.7 + Math.floor(armor - 1) * 0.6
                    var minDmg = Math.floor((power[0] - maxDef) * getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell))
                    var maxDmg = Math.floor((power[1] - minDef) * getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell))
                    var minPropDmg = Math.floor(hp.defender.now * 0.06)
                    var maxPropDmg = Math.max(Math.floor(hp.defender.now * 0.14 - 0.08), 0) // オーバーキル用
                    var minSunkDmg = Math.floor(hp.defender.now * 0.5)
                    var maxSunkDmg = Math.floor(hp.defender.now * 0.8 - 0.3)
                    var redCondDying = isHp1ReplacementShip(ship.defender, attack.defender === 0) && ((hp.defender.now - attack.damage) === 1)
                    var covered = minPropDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxPropDmg || !attack.friendAttack && (minSunkDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxSunkDmg || redCondDying)
                    if (!(minDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxDmg || covered)) {
                        var ammoBonus = getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell)
                        // キャップ後攻撃力(最小) = ダメージ / 弾薬補正 + 装甲乱数(最小)
                        var minPostcapPower = attack.damage / ammoBonus + minDef
                        // キャップ後攻撃力(最大) = (ダメージ + 1) / 弾薬補正 + 装甲乱数(最大)
                        var maxPostcapPower = (attack.damage + 1) / ammoBonus + maxDef
                        var inversion = {
                            min: minPostcapPower / power[1],
                            max: maxPostcapPower / power[0],
                            date:date.getTime()
                        }

                        if (mapCell.map[0] >= 22 && attack.friendAttack) {
                            // 熟練度
                            var skilled = getSkilledBonus(date, attack, ship.attacker, ship.defender, hp.attacker)
                            // 割合ダメージ等ではない&(敵が陸上型またはPT小鬼群または熟練度補正攻撃ではない)
                            if (!covered && !(isGround(ship.defender) || isPtImpPack(ship.defender) || skilled[0] > 1)) {
                                var maps = JSON.stringify(Java.from(mapCell.map))
                                var index = ship.attacker.shipId + "_" + ship.attacker.friendlyName.replace(/\(.*\)$/, "") + "_" + ship.defender.shipId + "_" + ship.defender.friendlyName.replace(/\(.*\)$/, "")

                                if (!unexpected[maps]) {
                                    unexpected[maps] = {}
                                }
                                if (!unexpected[maps][index]) {
                                    unexpected[maps][index] = []
                                }
                                unexpected[maps][index].push(inversion)
                            }
                        }
                        result.push(new DetectDto(date, mapCell, 2, attack, power, ship.attacker, ship.defender, hp.attacker, hp.defender, kind, friendCombinedKind, isEnemyCombined, formation, touchPlane, _shouldUseSkilled, origins, false, inversion, isBalloonCell))
                    }
                }
                damageHandling(ship.defender, hp.defender, attack.damage, attack.lastAttack) // ダメージ処理
            })
        })
    }
    return result
}

/**
 * レーダー検知
 * @param {java.util.Date} date 戦闘日時
 * @param {logbook.dto.MapCellDto} mapCell マップ
 * @param {logbook.dto.BattlePhaseKind} kind 戦闘の種類
 * @param {0|1|2|3} friendCombinedKind 自軍側連合種別(0=なし,1=機動,2=水上,3=輸送)
 * @param {Boolean} isEnemyCombined 敵軍は連合艦隊か
 * @param {[number,number,number]} formation 昼戦[自軍陣形,敵軍陣形,交戦形態]
 * @param {[[AttackDto]]} attackList 攻撃リスト
 * @param {FleetDto} friends 自艦隊データ
 * @param {FleetDto} enemies 敵艦隊データ
 * @param {FleetHpDto} friendHp 自艦隊Hp
 * @param {FleetHpDto} enemyHp 敵艦隊Hp
 * @param {Boolean} shouldUseSkilled 熟練度を使用すべきか(default=true)
 * @param {Boolean} isBalloonCell 阻塞気球発動可能マスか
 * @param {{}} unexpected 異常ダメージデータ
 * @return {[DetectDto]} 異常データ
 */
var detectRadarShooting = function (date, mapCell, kind, friendCombinedKind, isEnemyCombined, formation, attackList, friends, enemies, friendHp, enemyHp, shouldUseSkilled, isBalloonCell, unexpected) {
    var result = []
    if (attackList) {
        attackList.forEach(function (attacks) {
            attacks.filter(function (attack) {
                // 攻撃ミスは除外
                return (attack.critical | 0) > 0
            }).forEach(function (attack) {
                var ship = extractInvolvedShips(attack, friends, enemies)
                var numOfAttackShips = (attack.friendAttack ? friendHp : enemyHp)[attack.mainAttack ? "main" : "escort"].length
                var hp = extractInvolvedShipHps(attack, friendHp, enemyHp)
                // 味方潜水への攻撃は検出対象から除外(敵対潜値が不明のため)
                if (!(!attack.friendAttack && isSubMarine(ship.defender))) {
                    // 特殊攻撃は熟練度の対象から外す
                    var _shouldUseSkilled = shouldUseSkilled && attack.attackType < 100
                    var origins = attack.friendAttack ? friends : enemies
                    var power = getRadarShootingPower(date, mapCell, kind, friendCombinedKind, isEnemyCombined, numOfAttackShips, formation, attack, ship.attacker, ship.defender, hp.attacker, _shouldUseSkilled, attack.friendAttack ? friends : enemies).getPostcapPower()
                    var armor = Math.max(ship.defender.soukou + getArmorBonus(date, mapCell, ship.attacker, ship.defender), 1)
                    var minDef = armor * 0.7
                    var maxDef = armor * 0.7 + Math.floor(armor - 1) * 0.6
                    var minDmg = Math.floor((power[0] - maxDef) * getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell))
                    var maxDmg = Math.floor((power[1] - minDef) * getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell))
                    var minPropDmg = Math.floor(hp.defender.now * 0.06)
                    var maxPropDmg = Math.max(Math.floor(hp.defender.now * 0.14 - 0.08), 0) // オーバーキル用
                    var minSunkDmg = Math.floor(hp.defender.now * 0.5)
                    var maxSunkDmg = Math.floor(hp.defender.now * 0.8 - 0.3)
                    var redCondDying = isHp1ReplacementShip(ship.defender, attack.defender === 0) && ((hp.defender.now - attack.damage) === 1)
                    var covered = minPropDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxPropDmg || !attack.friendAttack && minSunkDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxSunkDmg || redCondDying
                    if (!(minDmg <= Math.floor(attack.damage) && Math.floor(attack.damage) <= maxDmg || covered)) {
                        var ammoBonus = getAmmoBonus(ship.attacker, attack.friendAttack ? friends : enemies, mapCell)
                        // キャップ後攻撃力(最小) = ダメージ / 弾薬補正 + 装甲乱数(最小)
                        var minPostcapPower = attack.damage / ammoBonus + minDef
                        // キャップ後攻撃力(最大) = (ダメージ + 1) / 弾薬補正 + 装甲乱数(最大)
                        var maxPostcapPower = (attack.damage + 1) / ammoBonus + maxDef
                        var inversion = {
                            min: minPostcapPower / power[1],
                            max: maxPostcapPower / power[0],
                            date:date.getTime()
                        }

                        result.push(new DetectDto(date, mapCell, 2, attack, power, ship.attacker, ship.defender, hp.attacker, hp.defender, kind, friendCombinedKind, isEnemyCombined, formation, [-1, -1], _shouldUseSkilled, origins, true, inversion, isBalloonCell))
                    }
                }
                damageHandling(ship.defender, hp.defender, attack.damage, attack.lastAttack) // ダメージ処理
            })
        })
    }
    return result
}

//#endregion
