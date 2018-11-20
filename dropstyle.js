//script読み込み
load("script/ScriptData.js")
load("script/UnexpectedDamage.js")

//Import部分
SimpleDateFormat = Java.type("java.text.SimpleDateFormat")
Optional = Java.type("java.util.Optional")
ConcurrentHashMap = Java.type("java.util.concurrent.ConcurrentHashMap")
IntStream = Java.type("java.util.stream.IntStream")
FillLayout = Java.type("org.eclipse.swt.layout.FillLayout")
SWT = Java.type("org.eclipse.swt.SWT")
ShellAdapter = Java.type("org.eclipse.swt.events.ShellAdapter")
TableItem = Java.type("org.eclipse.swt.widgets.TableItem")
Browser = Java.type("org.eclipse.swt.browser.Browser")
Point = Java.type("org.eclipse.swt.graphics.Point")
Listener = Java.type("org.eclipse.swt.widgets.Listener")
Shell = Java.type("org.eclipse.swt.widgets.Shell")
SWTResourceManager = Java.type("org.eclipse.wb.swt.SWTResourceManager")
AppConstants = Java.type("logbook.constants.AppConstants")
ReportUtils = Java.type("logbook.util.ReportUtils")

var dateIndex = -1
var phaseIndex = [-1, -1, -1]

function begin(header) {
    IntStream.range(0, header.length).forEach(function (i) {
        if (header[i].equals("昼砲撃戦")) {
            phaseIndex[0] = i
        }
        if (header[i].equals("昼雷撃戦")) {
            phaseIndex[1] = i
        }
        if (header[i].equals("夜戦")) {
            phaseIndex[2] = i
        }
        if (header[i].equals("日付")) {
            dateIndex = i
        }
    })
}

var shell = null
var parent = null
var browser = null
var column = -1
var source = ""
var point = null

function create(table, data, index) {
    var items = data[0].get()
    var item = new TableItem(table, SWT.NONE)
    item.setData(items)
    // 偶数行に背景色を付ける
    if ((index % 2) !== 0) {
        item.setBackground(SWTResourceManager.getColor(AppConstants.ROW_BACKGROUND))
    }
    item.setText(ReportUtils.toStringArray(data))

    var WindowListener = new Listener({
        handleEvent: function (event) {
            switch (event.type) {
                case SWT.MouseDown: {
                    var selected = table.getSelectionIndex()
                    point = new Point(event.x, event.y)
                    var tableItem = table.getItem(point)
                    column = getColumnIndex(point, tableItem)
                    break
                }
                case SWT.DefaultSelection: {
                    var count = Optional.ofNullable(getData(table.getItem(point).data.battleDate)).orElse([]).map(function (dataList) {
                        return dataList.length
                    }).reduce(function (p, v) {
                        return p + v
                    }, 0)
                    if (selected != -1
                        && phaseIndex.some(function (index, i) { return index === column && count > 0 })) {
                        // 初期設定
                        if (shell === null) {
                            shell = new Shell(table.getShell(), SWT.CLOSE | SWT.TITLE | SWT.MAX | SWT.MIN | SWT.RESIZE)
                            shell.setLayout(new FillLayout(SWT.VERTICAL))
                            shell.addShellListener(new ShellAdapter({
                                shellClosed: function (e) {
                                    e.doit = false
                                    shell.setVisible(false)
                                }
                            }))
                            browser = new Browser(shell, SWT.NONE)
                            browser.setBounds(0, 0, 900, 670)
                            shell.pack()
                            shell.open()
                        } else {
                            shell.setVisible(true)
                        }
                        shell.setText("異常ダメージ検知 " + String(VERSION).replace(".", "").split("").join("."))
                        browser.setText(genBattleHtml(getData(table.getItem(point).data.battleDate)))
                    } else if (shell !== null) {
                        shell.setVisible(false)
                    }
                    break
                }
            }
        }
    })

    if (getData("set") === null) {
        table.addListener(SWT.MouseDown, WindowListener)
        table.addListener(SWT.DefaultSelection, WindowListener)
        setTmpData("set", true)
    }

    return item
}

function end() { }

function getColumnIndex(pt, item) {
    var columns = item.getParent().getColumnCount()
    return IntStream.range(0, columns).filter(function (index) {
        var rect = item.getBounds(index)
        return pt.x >= rect.x && pt.x < rect.x + rect.width
    }).findFirst().orElse(-1)
}

function toFormation(kind) {
    switch (kind) {
        case 1: return "単縦陣"
        case 2: return "複縦陣"
        case 3: return "輪形陣"
        case 4: return "梯形陣"
        case 5: return "単横陣"
        case 6: return "警戒陣"
        case 11: return "第一警戒航行序列"
        case 12: return "第二警戒航行序列"
        case 13: return "第三警戒航行序列"
        case 14: return "第四警戒航行序列"
        default: return "不明"
    }
}

function toIntercept(kind) {
    switch (kind) {
        case 1: return "同航戦"
        case 2: return "反航戦"
        case 3: return "T字有利"
        case 4: return "T字不利"
        default: return "不明"
    }
}

function toCombined(kind) {
    switch (kind) {
        case 1: return "機動連合"
        case 2: return "水上連合"
        case 3: return "輸送連合"
        default: return "通常艦隊"
    }
}

// Array.prototype.flat()
function flatten(array) {
    return array.reduce(function (a, c) {
        return Array.isArray(c) ? a.concat(flatten(c)) : a.concat(c)
    }, [])
}

function genBattleHtml(dataLists) {
    // データがあるものをひとまず検索
    var masterData = flatten([dataLists[0], dataLists[1], dataLists[2]]).filter(function (d) { return d })[0]
    var touchPlane = dataLists[2].length > 0 ? dataLists[2][0].touchPlane : [-1, -1]
    var sdf = new SimpleDateFormat(AppConstants.DATE_FORMAT)
    var idx = 0
    var html =
        '<html><head><style type="text/css">' +
        "body {font-family:'Lucida Grande','Hiragino Kaku Gothic ProN','ヒラギノ角ゴ ProN W3',Meiryo,メイリオ,sans-serif;}" +
        "div.box{margin-top:10px;margin-bottom:10px;font-size:small;}" +
        "body{background-color:#FAFAFA;}" +
        "h1{font-size: small;}" +
        "h2{font-size: small;}" +
        "h3{font-size: small;}" +
        "p {font-size: small;}" +
        "table{border:1px #BBB solid;border-collapse:collapse;font-size:small;}" +
        "table tr th{border:1px #BBB solid;border-collapse:collapse;background-color:#BFF;}" +
        "table tr{border:1px #BBB solid;border-collapse:collapse;padding:5px;}" +
        "table tr td{border:1px #BBB solid;border-collapse:collapse;padding:5px;background-color:#EEE;}" +
        ".label-syoha{color:#FC0;}" +
        ".label-tyuha{color:#F80;}" +
        ".label-taiha{color:#F00;}" +
        ".label-gotin{color:#00F;}" +
        "td.enemy{color:#F00;}" +
        "td.friend{color:#00F;}" +
        ".param{font-weight:bold;}" +
        "header{position:fixed;top:0px;left:0px;padding-left:10px;background-color:#FAFAFA;width:100%;}" +
        '</style></head>' +
        '<body>' +
        '<header>' +
        '<h2>' + masterData.mapCell + '（' + sdf.format(masterData.date) + '）</h2>' +
        '<h2>会敵情報</h2>' +
        '<div>会敵: ' + toIntercept(Number(masterData.formation[2])) + '</div>' +
        '<table>' +
        '<tr>' +
        '<th></th>' +
        '<th>艦隊</th>' +
        '<th>陣形</th>' +
        '<th title="夜戦時に異常ダメージがあった場合のみ表示">夜間触接</th>' +
        '</tr>' +
        '<tr>' +
        '<td>自</td>' +
        '<td>' + toCombined(masterData.friendCombinedKind) + '</td>' +
        '<td>' + toFormation(Number(masterData.formation[0])) + '</td>' +
        '<td>' + (touchPlane[0] > 0 ? Item.get(touchPlane[0]).name : "") + '</td>' +
        '</tr>' +
        '<tr>' +
        '<td>敵</td>' +
        '<td>' + (masterData.isEnemyCombined ? '連合艦隊' : '通常艦隊') + '</td>' +
        '<td>' + toFormation(Number(masterData.formation[1])) + '</td>' +
        '<td>' + (touchPlane[1] > 0 ? Item.get(touchPlane[1]).name : "") + '</td>' +
        '</tr>' +
        '</table>' +
        '<h2>異常ダメ検知攻撃一覧</h2>' +
        '<hr color:"#BBB" style="margin-right:15px;"></hr>' +
        '</header>' +
        '<div style="width:100%; height:235px;"></div>' +
        '<div style="overflow: auto; min-width:500px; border:#000000 solid 1px; width: 100%; font-size:small;">' +
        // 昼砲撃戦
        dataLists[0].map(function (data) {
            var power = getDayBattlePower(data.date, data.kind, data.friendCombinedKind, data.isEnemyCombined,
                data.attackNum, data.formation, data.attack, data.attacker, data.defender, data.attackerHp, data.shouldUseSkilled, data.origins)
            var result = '<div style="border:#000000 solid 1px; padding:5px; margin:5px; background-color:#fce4d6;">'
            result += genHeaderHtml(data, power)
            result += isSubMarine(data.defender) ? genAntiSubMarineHtml(data, power) : genDayBattleHtml(data, power)
            result += genDefenseArmorHtml(data)
            result += genGimmickHtml(data, power, idx++)
            return result + '</div>'
        }).join('') +
        // 昼雷撃戦
        dataLists[1].map(function (data) {
            var power = getTorpedoPower(data.date, data.kind, data.friendCombinedKind, data.isEnemyCombined,
                data.attackNum, data.formation, data.attack, data.attacker, data.defender, data.attackerHp)
            var result = '<div style="border:#000000 solid 1px; padding:5px; margin:5px; background-color:#ddebf7;">'
            result += genHeaderHtml(data, power)
            result += genTorpedoAttackHtml(data, power)
            result += genDefenseArmorHtml(data)
            result += genGimmickHtml(data, power, idx++)
            return result + '</div>'
        }).join('') +
        // 夜戦
        dataLists[2].map(function (data) {
            var power = getNightBattlePower(data.date, data.kind, data.friendCombinedKind, data.isEnemyCombined,
                data.attackNum, data.formation, data.touchPlane, data.attack, data.attacker, data.defender, data.attackerHp, data.shouldUseSkilled, data.origins)
            var result = '<div style="border:#000000 solid 1px; padding:5px; margin:5px; background-color:#e8d9f3;">'
            result += genHeaderHtml(data, power)
            result += isSubMarine(data.defender) ? genAntiSubMarineHtml(data, power) : genNightBattleHtml(data, power)
            result += genDefenseArmorHtml(data)
            result += genGimmickHtml(data, power, idx++)
            return result + '</div>'
        }).join('') +
        '</div>' +
        '</body></html>'
    return html
}

/**
 * 名前や理論値などのヘッダー部分のHTMLを生成して返す
 * @param {DetectDto} data 検知データ
 * @param {AntiSubmarinePower|DayBattlePower|TorpedoPower|NightBattlePower} power 火力
 * @return {String} HTML
 */
function genHeaderHtml(data, power) {
    var result = '<table style="margin-bottom:5px;">'
    result += '<tr><th>艦</th><th></th><th>艦</th><th>ダメージ</th><th>残りHP</th><th>理論値</th><th>弾薬補正</th></tr>'
    var armor = data.defender.soukou + getArmorBonus(data.mapCell, data.attacker, data.defender)
    var aftPower = power.getAfterCapPower()
    var dmgWidth = Math.floor(aftPower[0] - armor * 1.3 + 0.6) + " ~ " + Math.floor(aftPower[1] - armor * 0.7)
    result += '<tr><td class="' + (data.attacker.isFriend() ? 'friend' : 'enemy') + '">' + (data.attack.attacker + 1) + '.' + data.attacker.friendlyName + '</td><td>→</td><td class="' + (data.defender.isFriend() ? 'friend' : 'enemy') + '">'
        + (data.attack.defender + 1) + '.' + data.defender.friendlyName + '</td><td style="' + (isCritical(data.attack) ? 'font-weight:bold;' : '') + '">' + data.attack.damage + '</td><td class="' + (data.defender.isFriend() ? 'friend' : 'enemy') + '">'
        + data.defenderHp.now + '→' + (data.defenderHp.now - data.attack.damage) + '</td><td>' + dmgWidth + '</td><td>' + getAmmoBonus(data.attacker).toFixed(2) + '</td></tr>'
    result += '</table>'
    return result
}

/**
 * 防御側の装甲部分のHTMLを生成して返す
 * @param {DetectDto} data 検知データ
 * @return {String} HTML
 */
function genDefenseArmorHtml(data) {
    var result = '<table style="margin-top:5px; float:left; margin-right:5px;">'
    result += '<tr><th colspan="4">防御側</th></tr>'
    result += '<tr><th>装甲乱数</th><th>実装甲値</th><th>表示装甲値</th><th>特殊補正</th>'
    var armor = data.defender.soukou + getArmorBonus(data.mapCell, data.attacker, data.defender)
    result += '<tr><td style="font-weight:bold;">' + (armor * 0.7).toFixed(1) + ' ~ ' + (armor * 1.3 - 0.6).toFixed(1) + '</td><td>' + armor + '</td><td>' + data.defender.soukou + '</td><td>' + getArmorBonus(data.mapCell, data.attacker, data.defender) + '</td></tr>'
    result += '</table>'
    return result
}

/**
 * ギミック簡易計算用のHTMLを生成して返す
 * @param {DetectDto} data 検知データ
 * @param {DayBattlePower|AntiSubmarinePower|TorpedoPower|NightBattlePower} power 火力
 * @return {String} HTML
 */
function genGimmickHtml(data, power, idx) {
    var result = '<script type="text/javascript">'
    result += 'function func' + idx + '(){'
    result += 'var gimmick = document.getElementById("gimmick' + idx + '").value;'
    result += 'var minA = Math.floor(' + power.getAfterCapPower()[0] + ' * gimmick);'
    result += 'var maxA = Math.floor(' + power.getAfterCapPower()[1] + ' * gimmick);'
    result += 'var armor = ' + (data.defender.soukou + getArmorBonus(data.mapCell, data.attacker, data.defender)) + ';'
    result += 'document.getElementById("afterpower' + idx + '").innerHTML = minA + " ~ " + maxA;'
    result += 'document.getElementById("theoretical' + idx + '").innerHTML = Math.floor(minA - armor * 1.3 + 0.6) + " ~ " + Math.floor(maxA - armor * 0.7);'
    result += 'document.getElementById("border' + idx + '").innerHTML = Math.floor(maxA - armor * 0.7) >= ' + Math.floor(data.attack.damage) + ' && ' + Math.floor(data.attack.damage) + ' >= Math.floor(minA - armor * 1.3 + 0.6) ? "○" : "x";'
    result += '}</script>'
    result += '<table style="margin-top:5px;">'
    result += '<tr><th colspan="4">ギミック簡易計算(a10)</th></tr>'
    result += '<tr><th>倍率</th><th>ギミック後攻撃力</th><th>理論値</th><th>範囲内</th>'
    result += '<tr><td><input id="gimmick' + idx + '" type="number" value="1" style="width: 80px;" onkeyup="func' + idx + '();"></td>'
    var armor = data.defender.soukou + getArmorBonus(data.mapCell, data.attacker, data.defender)
    var aftPower = power.getAfterCapPower()
    var dmgWidth = Math.floor(aftPower[0] - armor * 1.3 + 0.6) + " ~ " + Math.floor(aftPower[1] - armor * 0.7)
    result += '<td id="afterpower' + idx + '">' + aftPower[0] + ' ~ ' + aftPower[1] + '</td><td id="theoretical' + idx + '">' + dmgWidth + '</td><td id="border' + idx + '">x</td></tr>'
    result += '</table>'
    return result
}

/**
 * 対潜のHTMLを生成して返す
 * @param {DetectDto} data 検知データ
 * @param {AntiSubmarinePower} power 対潜火力
 * @return {String} HTML
 */
function genAntiSubMarineHtml(data, power) {
    var result = '<tr><th rowspan="8" style="padding: 0px 3px;">攻<br>撃<br>側</th><th>基本攻撃力</th><th>改修火力</th><th>艦種定数</th><th></th><th></th></tr>'
    result += '<tr><td>' + power.getBasePower().toFixed(2) + '</td><td>' + power.getImprovementBonus().toFixed(2) + '</td><td>' + power.getShipTypeConstant() + '</td><td></td><td></td></tr>'
    result += '<tr><th>キャップ前火力</th><th>交戦形態補正</th><th>攻撃側陣形補正</th><th>損傷補正</th><th>シナジー補正</th></tr>'
    result += '<tr><td>' + power.getBeforeCapPower().toFixed(2) + '</td><td>' + getFormationMatchBonus(data.formation).toFixed(1) + '</td><td>' + power.getFormationBonus().toFixed(1) + '</td><td>' + power.getConditionBonus().toFixed(1) + '</td><td>' + power.getSynergyBonus().toFixed(2) + '</td></tr>'
    result += '<tr><th>最終攻撃力</th><th>キャップ値</th><th>キャップ後火力</th><th>クリティカル補正</th><th>熟練度補正</th></tr>'
    var skilled = data.shouldUseSkilled ? getSkilledBonus(data.date, data.attack, data.attacker, data.defender, data.attackerHp).map(function (value) { return value.toFixed(2) }).join(' ~ ') : '1.00'
    result += '<tr><td style="font-weight:bold;">' + power.getAfterCapPower().map(function (power) { return power.toFixed(2) }).join(' ~ ') + '</td><td>' + power.CAP_VALUE + '</td><td>' + getAfterCapValue(power.getBeforeCapPower(), power.CAP_VALUE).toFixed(2) + '</td><td>' + getCriticalBonus(data.attack).toFixed(1) + '</td><td>' + skilled + '</td>'
    return '<table>' + result + '</table>'
}

/**
 * 昼砲撃戦のHTMLを生成して返す
 * @param {DetectDto} data 検知データ
 * @param {DayBattlePower} power 砲撃火力
 * @return {String} HTML
 */
function genDayBattleHtml(data, power) {
    var result = '<tr><th rowspan="8" style="padding: 0px 3px;">攻<br>撃<br>側</th><th>基本攻撃力</th><th>改修火力</th><th>連合補正</th><th></th><th></th><th></th><th></th></th>'
    result += '<tr><td>' + power.getBasePower().toFixed(2) + '</td><td>' + power.getImprovementBonus().toFixed(2) + '</td><td>' + power.getCombinedPowerBonus() + '</td><td></td><td></td><td></td><td></td></tr>'
    result += '<tr><th>キャップ前火力</th><th>陸上補正</th><th>WG補正</th><th>交戦形態補正</th><th>攻撃側陣形補正</th><th>損傷補正</th><th>特殊砲補正</th></tr>'
    result += '<tr><td>' + power.getBeforeCapPower().toFixed(2) + '</td><td>' + getLandBonus(data.attacker, data.defender).toFixed(2) + '</td><td>' + getWg42Bonus(data.attacker, data.defender) + '</td><td>' + getFormationMatchBonus(data.formation).toFixed(1) + '</td><td>' + power.getFormationBonus().toFixed(1) + '</td><td>' + power.getConditionBonus().toFixed(1) + '</td><td>' + getOriginalGunPowerBonus(power.attacker).toFixed(2) + '</td></tr>'
    result += '<tr><th rowspan="2">最終攻撃力</th><th>キャップ値</th><th>キャップ後火力</th><th>特殊敵乗算特効</th><th>特殊敵加算特効</th><th></th><th></th></tr>'
    result += '<tr><td>' + power.CAP_VALUE + '</td><td>' + getAfterCapValue(power.getBeforeCapPower(), power.CAP_VALUE).toFixed(2) + '</td><td>' + getMultiplySlayerBonus(data.attacker, data.defender).toFixed(2) + '</td><td>' + getAddSlayerBonus(data.attacker, data.defender) + '</td><td></td><td></td></tr>'
    result += '<tr><td rowspan="2" style="font-weight:bold;">' + power.getAfterCapPower().map(function (power) { return power.toFixed(2) }).join(' ~ ') + '</td><th>弾着観測射撃補正</th><th>戦爆連合CI攻撃補正</th><th>徹甲弾補正</th><th>クリティカル補正</th><th>熟練度補正</th><th></th></tr>'
    var skilled = data.shouldUseSkilled ? getSkilledBonus(data.date, data.attack, data.attacker, data.defender, data.attackerHp).map(function (value) { return value.toFixed(2) }).join(' ~ ') : '1.00'
    result += '<tr><td>' + power.getSpottingBonus().toFixed(2) + '</td><td>' + power.getUnifiedBombingBonus().toFixed(2) + '</td><td>' + power.getAPshellBonus().toFixed(2) + '</td><td>' + getCriticalBonus(data.attack).toFixed(1) + '</td><td>' + skilled + '</td><td></td></tr>'
    return '<table>' + result + '</table>'
}

/**
 * 昼雷撃戦のHTMLを生成して返す
 * @param {DetectDto} data 検知データ
 * @param {TorpedoPower} power 雷撃火力
 * @return {String} HTML
 */
function genTorpedoAttackHtml(data, power) {
    var result = '<tr><th rowspan="8" style="padding: 0px 3px;">攻<br>撃<br>側</th><th>基本攻撃力</th><th>改修火力</th><th>連合補正</th><th></th></tr>'
    result += '<tr><td>' + power.getBasePower().toFixed(2) + '</td><td>' + power.getImprovementBonus().toFixed(2) + '</td><td>' + power.getCombinedPowerBonus() + '</td><td></td></tr>'
    result += '<tr><th>キャップ前火力</th><th>交戦形態補正</th><th>攻撃側陣形補正</th><th>損傷補正</th></tr>'
    result += '<tr><td>' + power.getBeforeCapPower().toFixed(2) + '</td><td>' + getFormationMatchBonus(data.formation).toFixed(1) + '</td><td>' + power.getFormationBonus().toFixed(1) + '</td><td>' + power.getConditionBonus().toFixed(1) + '</td></tr>'
    result += '<tr><th>最終攻撃力</th><th>キャップ値</th><th>キャップ後火力</th><th>クリティカル補正</th></tr>'
    result += '<tr><td style="font-weight:bold;">' + power.getAfterCapPower()[0] + '</td><td>' + power.CAP_VALUE + '</td><td>' + getAfterCapValue(power.getBeforeCapPower(), power.CAP_VALUE).toFixed(2) + '</td><td>' + getCriticalBonus(data.attack).toFixed(1) + '</td>'
    return '<table>' + result + '</table>'
}

/**
 * 夜戦のHTMLを生成して返す
 * @param {DetectDto} data 検知データ
 * @param {NightBattlePower} power 夜戦火力
 * @return {String} HTML
 */
function genNightBattleHtml(data, power) {
    var result = '<tr><th rowspan="8" style="padding: 0px 3px;">攻<br>撃<br>側</th><th>基本攻撃力</th><th>改修火力</th><th>触接補正</th><th></th><th></th><th></th><th></th></th>'
    result += '<tr><td>' + power.getBasePower().toFixed(2) + '</td><td>' + power.getImprovementBonus().toFixed(2) + '</td><td>' + power.getNightTouchPlaneBonus() + '</td><td></td><td></td><td></td><td></td></tr>'
    result += '<tr><th>キャップ前火力</th><th>陸上補正</th><th>WG補正</th><th>攻撃側陣形補正</th><th>夜戦特殊攻撃補正</th><th>損傷補正</th><th>特殊砲補正</th></tr>'
    result += '<tr><td>' + power.getBeforeCapPower().toFixed(2) + '</td><td>' + getLandBonus(data.attacker, data.defender).toFixed(2) + '</td><td>' + getWg42Bonus(data.attacker, data.defender) + '</td><td>' + power.getFormationBonus().toFixed(1) + '</td><td>' + power.getCutinBonus().toFixed(2) + '</td><td>' + power.getConditionBonus().toFixed(1) + '</td><td>' + getOriginalGunPowerBonus(power.attacker).toFixed(2) + '</td></tr>'
    result += '<tr><th rowspan="2">最終攻撃力</th><th>キャップ値</th><th>キャップ後火力</th><th>特殊敵乗算特効</th><th>特殊敵加算特効</th><th></th><th></th></tr>'
    result += '<tr><td>' + power.CAP_VALUE + '</td><td>' + getAfterCapValue(power.getBeforeCapPower(), power.CAP_VALUE).toFixed(2) + '</td><td>' + getMultiplySlayerBonus(data.attacker, data.defender).toFixed(2) + '</td><td>' + getAddSlayerBonus(data.attacker, data.defender) + '</td><td></td><td></td></tr>'
    result += '<tr><td rowspan="2" style="font-weight:bold;">' + power.getAfterCapPower().map(function (power) { return power.toFixed(2) }).join('~') + '</td><th>クリティカル補正</th><th>熟練度補正</th><th></th><th></th><th></th><th></th></tr>'
    var skilled = data.shouldUseSkilled ? getSkilledBonus(data.date, data.attack, data.attacker, data.defender, data.attackerHp).map(function (value) { return value.toFixed(2) }).join(' ~ ') : '1.00'
    result += '<tr><td>' + getCriticalBonus(data.attack).toFixed(1) + '</td><td>' + skilled + '</td><td></td><td></td><td></td><td></td></tr>'
    return '<table>' + result + '</table>'
}
