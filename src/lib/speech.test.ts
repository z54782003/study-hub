import { describe, expect, it } from "vitest";
import { keepWordJa, speakableJa, stripReadings } from "./speech";

describe("speakableJa", () => {
  it("cleans the reading formats in the DBs", () => {
    expect(speakableJa("よみます（読む）")).toBe("よみます");
    expect(speakableJa("はたらきます［はたらく］")).toBe("はたらきます");
    expect(speakableJa("あそびます／あそぶ")).toBe("あそびます");
    expect(speakableJa("う.まれる・い.きる")).toBe("うまれる");
    expect(speakableJa("〜じゅう")).toBe("じゅう");
  });
  it("falls back to the word when there is no reading", () => expect(speakableJa("", "～才")).toBe("才"));
  it("says multi-kanji words as written so the voice gets the word right", () => {
    expect(speakableJa("ちゅうしゃ", "駐車・する")).toBe("駐車する");
    expect(speakableJa("しょうがっこう", "小学校")).toBe("小学校");
    expect(speakableJa("きょう", "今日")).toBe("きょう");
    expect(speakableJa("かよう", "通う")).toBe("かよう");
    expect(speakableJa("おみやげ", "お土産")).toBe("おみやげ");
    expect(speakableJa("おこのみやき", "お好み焼き")).toBe("お好み焼き");
    expect(speakableJa("けんがくかい", "見学会")).toBe("けんがくかい");
    expect(stripReadings("見学会（けんがくかい）に行（い）きました。")).toBe("けんがくかいにいきました。");
    // 丈夫：照漢字送會被唸成おっと（丈夫＝先生），要念 じょうぶ；大丈夫照原字
    expect(speakableJa("じょうぶ", "丈夫(な)")).toBe("じょうぶ");
    expect(speakableJa("じょうぶ", "丈夫な")).toBe("じょうぶ");
    expect(stripReadings("丈夫（じょうぶ）な靴（くつ）")).toBe("じょうぶなくつ");
    expect(stripReadings("もう大丈夫（だいじょうぶ）です。")).toBe("もう大丈夫です。");
    // 〜円札：照漢字送語音可能把「札」念成ふだ，念讀音
    expect(stripReadings("一万円札（いちまんえんさつ）を千円札（せんえんさつ）に")).toBe("いちまんえんさつをせんえんさつに");
    // 学生証、自分：單字按鈕念讀音，例句照漢字
    expect(speakableJa("がくせいしょう", "学生証")).toBe("がくせいしょう");
    expect(speakableJa("じぶん", "自分")).toBe("じぶん");
    expect(stripReadings("学生証（がくせいしょう）を見（み）せてください。", "学生証")).toBe("学生証を見せてください。");
    // おかわり：假名的高低音不穩，送漢字
    expect(stripReadings("コーヒーのおかわりはいかがですか。")).toBe("コーヒーのお代わりはいかがですか。");
    expect(stripReadings("おかわり")).toBe("お代わり");
    // 飲み放題：照漢字送語音會念錯，單字和例句都念讀音
    expect(speakableJa("のみほうだい", "飲み放題")).toBe("のみほうだい");
    expect(stripReadings("二時間（にじかん）の飲（の）み放題（ほうだい）コース", "")).toBe("二時間ののみほうだいコース");
    expect(stripReadings("お酒（さけ）は二十歳（はたち）から飲（の）める")).toBe("おさけわハタチから飲める");
  });
});

describe("stripReadings", () => {
  it("reads marked kanji by their furigana, once", () => {
    expect(stripReadings("明日は大事な面接（めんせつ）があるので、今日美容院で髪を切りました。")).toBe("明日は大事な面接があるので、今日美容院で髪を切りました。");
    expect(stripReadings("弟（おとうと）は小学校（しょうがっこう）に通（かよ）っています。")).toBe("おとうとわ小学校にかよっています。");
  });
  it("writes the particles は／へ after a reading the way they sound", () => {
    expect(stripReadings("電車（でんしゃ）は午後（ごご）三時（さんじ）に駅（えき）に着（つ）きます。")).toBe("電車は午後三時にえきにつきます。");
    expect(stripReadings("この時計（とけい）は五分（ごふん）遅（おく）れて止（と）まりました。")).toBe("この時計は五分おくれてとまりました。");
    expect(stripReadings("学校（がっこう）へ行（い）きます。")).toBe("学校へいきます。");
    expect(stripReadings("早（はや）く")).toBe("ハヤく");
    expect(stripReadings("駅（えき）へ行（い）きます。")).toBe("えきえいきます。");
    expect(stripReadings("今日（きょう）は")).toBe("きょうわ");
  });
  it("keeps a word with several furigana'd kanji whole", () => {
    expect(stripReadings("お好（この）み焼（や）きを食（た）べました。")).toBe("お好み焼きをたべました。");
    expect(stripReadings("髪（かみ）の毛（け）を切（き）る")).toBe("髪の毛をきる");
    // 「聞」照原字唸：換成 き 會和前面的「と」變成「とき」
    expect(stripReadings("引（ひ）っ越（こ）すと聞（き）いて")).toBe("引っ越すと聞いて");
    // 「棚の上」是兩個詞，不合併（棚本身在 KEEP_ONE，照原字）
    expect(stripReadings("あの棚（たな）の上（うえ）にある")).toBe("あの棚のうえにある");
    // 讀音裡多寫了前面的 お／ご：不要唸成「ごごはん」
    expect(stripReadings("ご飯（ごはん）を食（た）べる")).toBe("ごハンをたべる");
    expect(stripReadings("お湯（おゆ）を沸（わ）かす")).toBe("おゆをわかす");
    // 「動く歩道」整個照原字，語音才會當成一個詞
    expect(stripReadings("これは動（うご）く歩道（ほどう）です。")).toBe("これは動く歩道です。");
    // 棚：單字按鈕和例句都送漢字，語音才會用正確的平板重音
    expect(speakableJa("たな", "棚")).toBe("棚");
    expect(stripReadings("棚（たな）に本（ほん）を置（お）く")).toBe("棚にほんをおく");
    // 「少し」和後面的詞分開
    expect(stripReadings("少（すこ）し悲（かな）しくなりました。")).toBe("すこしかなしくなりました。");
    // 複合詞照舊合在一起
    expect(stripReadings("締（し）め切（き）りは来週（らいしゅう）です。")).toBe("締め切りは来週です。");
    expect(stripReadings("申（もう）し込（こ）みます")).toBe("申し込みます");
    // 「の」前後是不同的詞：各自照讀音唸，夜才不會被唸成 よ
    expect(stripReadings("昨日（きのう）の夜（よる）、空（そら）を飛（と）ぶ夢（ゆめ）を見（み）ました。")).toBe("きのうのよる、そらをとぶゆめを見ました。");
    expect(stripReadings("駅（えき）に着（つ）きます")).toBe("えきにつきます");
  });
  it("says the card's word in an example the same way as the word button", () => {
    expect(speakableJa("たこやき", "たこ焼き")).toBe("たこ焼き");
    expect(keepWordJa("たこ焼き")).toBe("たこ焼き");
    expect(stripReadings("たこ焼（や）きが大好（だいす）きです。", keepWordJa("たこ焼き"))).toBe("たこ焼きが大好きです。");
    expect(keepWordJa("通う")).toBe("");
    expect(keepWordJa("駐車・する")).toBe("駐車");
  });
  it("drops a stray reading that does not follow kanji", () => {
    expect(stripReadings("たばこをやめる（たばこをやめる）")).toBe("たばこをやめる");
  });
  it("keeps brackets that are not readings", () => {
    expect(stripReadings("駅（東口）で会いましょう。")).toBe("駅（東口）で会いましょう。");
  });
});
