# -*- coding: utf-8 -*-
# char | on | kun | es | lesson
RAW = """
3|一|いち,いつ|ひと(つ)|uno
3|二|に|ふた(つ)|dos
3|三|さん|み(つ)|tres
3|四|し|よん,よ(つ)|cuatro
3|五|ご|いつ(つ)|cinco
3|六|ろく|む(つ)|seis
3|七|しち|なな(つ)|siete
3|八|はち|や(つ)|ocho
3|九|きゅう,く|ここの(つ)|nueve
3|十|じゅう|とお|diez
3|百|ひゃく||cien
3|千|せん|ち|mil
3|万|まん||diez mil
3|円|えん|まる(い)|yen; círculo
3|時|じ|とき|hora; tiempo
4|日|にち,じつ|ひ,か|día; sol
4|本|ほん|もと|libro; origen
4|人|じん,にん|ひと|persona
4|月|げつ,がつ|つき|luna; mes
4|火|か|ひ|fuego
4|水|すい|みず|agua
4|木|もく,ぼく|き|árbol; madera
4|金|きん|かね|oro; dinero; metal
4|土|ど|つち|tierra; suelo
4|曜|よう||día de la semana
4|上|じょう|うえ,あ(げる),のぼ(る)|arriba; encima
4|下|か,げ|した,さ(げる),くだ(さる)|abajo; debajo
4|中|ちゅう|なか|centro; dentro; en medio
4|半|はん|なか(ば)|mitad; medio
5|山|さん|やま|montaña
5|川|せん|かわ|río
5|元|げん,がん|もと|origen; ánimo
5|気|き,け||espíritu; ánimo; aire
5|天|てん|あめ,あま|cielo
5|私|し|わたし,わたくし|yo; privado
5|今|こん,きん|いま|ahora
5|田|でん|た|arrozal
5|女|じょ|おんな|mujer
5|男|だん|おとこ|hombre
5|見|けん|み(る)|ver; mirar
5|行|こう,ぎょう|い(く),おこな(う)|ir
5|食|しょく|た(べる),く(う)|comer; comida
5|飲|いん|の(む)|beber
6|東|とう|ひがし|este
6|西|せい,さい|にし|oeste
6|南|なん|みなみ|sur
6|北|ほく|きた|norte
6|口|こう,く|くち|boca; entrada
6|出|しゅつ|で(る),だ(す)|salir; sacar
6|右|う,ゆう|みぎ|derecha
6|左|さ|ひだり|izquierda
6|分|ぶん,ふん|わ(かる),わ(ける)|minuto; parte; entender
6|先|せん|さき|anterior; antes; punta
6|生|せい,しょう|い(きる),う(まれる),なま|vida; nacer; crudo
6|大|だい,たい|おお(きい)|grande
6|学|がく|まな(ぶ)|estudiar; aprender
6|外|がい,げ|そと,ほか|fuera; extranjero
6|国|こく|くに|país
7|京|きょう,けい||capital
7|子|し,す|こ|niño; hijo
7|小|しょう|ちい(さい),こ,お|pequeño
7|会|かい,え|あ(う)|encontrarse; reunión
7|社|しゃ|やしろ|compañía; santuario
7|父|ふ|ちち|padre
7|母|ぼ|はは|madre
7|高|こう|たか(い)|alto; caro
7|校|こう||escuela
7|毎|まい||cada; todos los
7|語|ご|かた(る)|idioma; palabra
7|文|ぶん,もん|ふみ|oración; escritura; texto
7|帰|き|かえ(る)|volver (a casa)
7|入|にゅう|い(れる),はい(る)|entrar; meter
8|員|いん||miembro; empleado
8|新|しん|あたら(しい),あら(た)|nuevo
8|聞|ぶん,もん|き(く)|oír; escuchar; preguntar
8|作|さく,さ|つく(る)|hacer; fabricar
8|仕|し|つか(える)|servir; trabajar
8|事|じ|こと|asunto; cosa; trabajo
8|電|でん||electricidad
8|車|しゃ|くるま|vehículo; auto
8|休|きゅう|やす(む)|descansar
8|言|げん,ごん|い(う),こと|decir; palabra
8|読|どく|よ(む)|leer
8|思|し|おも(う)|pensar
8|次|じ,し|つぎ,つ(ぐ)|siguiente; próximo
8|何|か|なに,なん|qué
9|午|ご||mediodía
9|後|ご,こう|のち,うし(ろ),あと|después; atrás
9|前|ぜん|まえ|antes; delante
9|名|めい,みょう|な|nombre
9|白|はく,びゃく|しろ(い)|blanco
9|雨|う|あめ|lluvia
9|書|しょ|か(く)|escribir
9|友|ゆう|とも|amigo
9|間|かん,けん|あいだ,ま|intervalo; entre
9|家|か,け|いえ,うち|casa; familia
9|話|わ|はな(す),はなし|hablar; conversación
9|少|しょう|すこ(し),すく(ない)|poco
9|古|こ|ふる(い)|viejo; antiguo
9|知|ち|し(る)|saber; conocer
9|来|らい|く(る),き|venir
10|住|じゅう|す(む)|vivir; residir
10|正|せい,しょう|ただ(しい),まさ|correcto
10|年|ねん|とし|año
10|売|ばい|う(る)|vender
10|買|ばい|か(う)|comprar
10|町|ちょう|まち|pueblo; ciudad; barrio
10|長|ちょう|なが(い)|largo; jefe
10|道|どう|みち|camino; calle
10|雪|せつ|ゆき|nieve
10|立|りつ,りゅう|た(つ)|ponerse de pie; levantarse
10|自|じ,し|みずか(ら)|uno mismo; por sí mismo
10|夜|や|よる,よ|noche
10|朝|ちょう|あさ|mañana (parte del día)
10|持|じ|も(つ)|tener; llevar
11|手|しゅ|て|mano
11|紙|し|かみ|papel
11|好|こう|す(き),この(む)|gustar
11|近|きん|ちか(い)|cerca
11|明|めい,みょう|あか(るい),あき(らか)|claro; brillante
11|病|びょう|や(む),やまい|enfermedad
11|院|いん||institución; hospital
11|映|えい|うつ(る),うつ(す)|reflejar; proyectar
11|画|が,かく||dibujo; imagen
11|歌|か|うた,うた(う)|canción; cantar
11|市|し|いち|ciudad; mercado
11|所|しょ|ところ|lugar
11|勉|べん||esforzarse
11|強|きょう,ごう|つよ(い)|fuerte
11|有|ゆう,う|あ(る)|tener; existir
11|旅|りょ|たび|viaje
12|昔|せき,しゃく|むかし|antiguamente; hace mucho
12|神|しん,じん|かみ|dios; deidad
12|早|そう,さっ|はや(い)|temprano
12|起|き|お(きる),お(こす)|levantarse; despertar
12|牛|ぎゅう|うし|vaca
12|使|し|つか(う)|usar
12|働|どう|はたら(く)|trabajar
12|連|れん|つ(れる)|llevar consigo; conectar
12|別|べつ|わか(れる)|separar; diferente
12|度|ど|たび|grado; vez
12|赤|せき|あか(い)|rojo
12|青|せい|あお(い)|azul
12|色|しょく,しき|いろ|color
"""
from genki_kanji import TEACH
KANJI=[]
for line in RAW.strip().splitlines():
    l,ch,on,kun,es=line.split('|')
    k=dict(char=ch,on=on.split(',') if on else [],kun=kun.split(',') if kun else [],es=[x.strip() for x in es.split(';')],genkiLesson=int(l))
    # Readings Genki prints come first (in Genki's order) and form `teach`; the rest follow.
    t_on,t_kun=TEACH[ch]
    k['on']=t_on+[x for x in k['on'] if x not in t_on]
    k['kun']=t_kun+[x for x in k['kun'] if x not in t_kun]
    k['teach']=t_on+t_kun
    KANJI.append(k)
CHARS={k['char'] for k in KANJI}|{'々'}
if __name__=='__main__': print(len(KANJI))
