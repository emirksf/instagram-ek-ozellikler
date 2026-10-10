import Cocoa
import WebKit
import UserNotifications

let IG_URL = URL(string: "https://www.instagram.com/")!
let UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, NSWindowDelegate, UNUserNotificationCenterDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var statusItem: NSStatusItem!
    var sbWindow: NSWindow?
    var sbWebView: WKWebView?
    var auxWindow: NSWindow?
    var auxWebView: WKWebView?
    var notificationsAllowed = false
    var pendingSection: String?   // panel henüz yüklenmemişken istenen bölüm (sayfa yüklenince açılır)
    var panelReloadTried = false  // panel bulunamazsa Instagram en fazla bir kez yeniden yüklenir

    // MARK: - Başlangıç
    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        setupStatusItem()
        setupNotifications()

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // kalıcı oturum
        let ucc = WKUserContentController()
        ucc.add(self, name: "igd")
        if let watcher = loadResource("watcher", "js") {
            ucc.addUserScript(WKUserScript(source: watcher, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        // Panel her Instagram sayfasında kendiliğinden yüklenir; uygulama doğrudan panelle açılır.
        if let panel = loadResource("inject", "js") {
            ucc.addUserScript(WKUserScript(source: panel, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        config.userContentController = ucc

        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1180, height: 820), configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.customUserAgent = UA
        webView.allowsBackForwardNavigationGestures = true

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1180, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false
        )
        window.title = "Emir Kosif · Instagram Takip Denetimi v2.0"
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.center()
        window.setFrameAutosaveName("InstaDenetimMain")
        window.contentView = webView
        window.minSize = NSSize(width: 840, height: 600)

        window.makeKeyAndOrderFront(nil)
        webView.load(URLRequest(url: IG_URL))
        NSApp.activate(ignoringOtherApps: true)
        // İlk açılış tanıtımı ve gizlilik bilgisi panelin içinde (inject.js → Tanıtım / Ayarlar).
    }

    // Pencere kapatılınca uygulamayı kapatma — izleyici menü çubuğunda çalışsın.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        guard sender == window else { return true }
        // İlk kapatışta bir kez: uygulama kapanmadı, menü çubuğunda çalışıyor.
        if !UserDefaults.standard.bool(forKey: "igd_close_hint_v1") {
            UserDefaults.standard.set(true, forKey: "igd_close_hint_v1")
            let a = NSAlert()
            a.messageText = "Uygulama menü çubuğunda çalışmaya devam ediyor"
            a.informativeText = "Takipçi bildirimleri ve profil izleme arka planda sürer. Pencereyi menü çubuğundaki simgeden geri açabilirsin. Tamamen kapatmak için simgedeki “Çıkış”ı ya da ⌘Q'yu kullan."
            a.addButton(withTitle: "Anladım")
            a.addButton(withTitle: "Uygulamadan Çık")
            if a.runModal() == .alertSecondButtonReturn { NSApp.terminate(nil); return false }
        }
        sender.orderOut(nil) // gizle
        return false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showWindow(); return true
    }

    func loadResource(_ name: String, _ ext: String) -> String? {
        guard let p = Bundle.main.path(forResource: name, ofType: ext) else { return nil }
        return try? String(contentsOfFile: p, encoding: .utf8)
    }

    // MARK: - Menü çubuğu simgesi
    func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let img = NSImage(systemSymbolName: "person.2.fill", accessibilityDescription: "Takip Denetimi") {
            img.isTemplate = true
            statusItem.button?.image = img
        } else {
            statusItem.button?.title = "IG"
        }
        let menu = NSMenu()
        menu.addItem(withTitle: "Paneli Göster", action: #selector(showPanelMenu), keyEquivalent: "")
        menu.addItem(withTitle: "Instagram'ı Göster", action: #selector(showInstagram), keyEquivalent: "")
        menu.addItem(withTitle: "SocialBlade Ara…", action: #selector(socialBladePrompt), keyEquivalent: "")
        menu.addItem(NSMenuItem.separator())
        let statusLine = NSMenuItem(title: "İzleyici: kapalı", action: nil, keyEquivalent: "")
        statusLine.tag = 99
        statusLine.isEnabled = false
        menu.addItem(statusLine)
        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "Çıkış", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        statusItem.menu = menu
    }

    @objc func showWindow() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: - Panel ⇄ Instagram (tek gezinme panelin kenar çubuğunda; menüler kısayol)
    @objc func showPanelMenu() { showWindow(); openPanel(nil) }
    @objc func showSettings() { showWindow(); openPanel("settings") }
    @objc func showPrivacy() { showWindow(); openPanel("settings#privacy") }

    @objc func showInstagram() {
        showWindow()
        webView.evaluateJavaScript("window.__igd ? (window.__igd.instagram(), true) : false") { _, _ in }
    }

    // Paneli (isteğe bağlı bir bölümle) aç. Panel bu sayfada yoksa Instagram'ı yükler; yüklenince açılır.
    func openPanel(_ section: String?) {
        let clean = section.map { String($0.unicodeScalars.filter { CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz#").contains($0) }) }
        let arg = clean.map { "\"\($0)\"" } ?? "undefined"
        webView.evaluateJavaScript("window.__igd ? (window.__igd.open(\(arg)), true) : false") { result, _ in
            // Yalnızca panel gerçekten yoksa (false) ve henüz denenmediyse yükle — sonsuz yeniden yükleme olmasın
            guard (result as? Bool) == false, !self.panelReloadTried else { return }
            self.panelReloadTried = true
            self.pendingSection = clean ?? ""
            self.webView.load(URLRequest(url: IG_URL))
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView == self.webView, let sec = pendingSection else { return }
        pendingSection = nil
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            if !sec.isEmpty { self.openPanel(sec) }
            self.panelReloadTried = false
        }
    }

    @objc func socialBladePrompt() {
        let a = NSAlert()
        a.messageText = "SocialBlade'de Ara"
        a.informativeText = "Instagram kullanıcı adını gir:"
        let tf = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        tf.placeholderString = "kullaniciadi"
        a.accessoryView = tf
        a.addButton(withTitle: "Aç")
        a.addButton(withTitle: "Vazgeç")
        a.window.initialFirstResponder = tf
        if a.runModal() == .alertFirstButtonReturn {
            openSocialBlade(tf.stringValue)
        }
    }

    private func alert(_ msg: String) {
        let a = NSAlert()
        a.messageText = "Instagram Takip Denetimi"
        a.informativeText = msg
        a.addButton(withTitle: "Tamam")
        a.runModal()
    }

    // MARK: - JS → Swift köprüsü
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "notify":
            notify(title: (body["title"] as? String) ?? "Instagram", text: (body["body"] as? String) ?? "",
                   panel: body["panel"] as? String)
        case "export":
            if let name = body["name"] as? String, let content = body["content"] as? String {
                saveExport(name: name, content: content, label: (body["label"] as? String) ?? "Dosya kaydedildi")
            }
        case "sb":
            if let u = body["username"] as? String { openSocialBlade(u) }
        case "watch":
            if let s = body["status"] as? String, let item = statusItem.menu?.item(withTag: 99) {
                item.title = "İzleyici: " + s
            }
        default: break
        }
    }

    // DM yedeğini / CSV'yi Downloads klasörüne yaz (kullanıcının kendi verisi, kendi isteğiyle).
    func saveExport(name: String, content: String, label: String) {
        let dir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
            ?? FileManager.default.homeDirectoryForCurrentUser
        let safe = (name as NSString).lastPathComponent
        let url = dir.appendingPathComponent(safe)
        do {
            try content.write(to: url, atomically: true, encoding: .utf8)
            notify(title: label, text: url.path, panel: nil)
        } catch {
            DispatchQueue.main.async { self.alert("Dosya kaydedilemedi: \(error.localizedDescription)") }
        }
    }

    // MARK: - Bildirimler
    // Uygulama adıyla gelir; tıklanınca ilgili panel bölümü açılır. İzin yoksa osascript'e düşer.
    func setupNotifications() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            DispatchQueue.main.async { self.notificationsAllowed = granted }
        }
    }

    func notify(title: String, text: String, panel: String?) {
        guard notificationsAllowed else { notifyViaScript(title: title, text: text); return }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = text
        content.sound = UNNotificationSound(named: UNNotificationSoundName("Glass"))
        if let p = panel { content.userInfo = ["panel": p] }
        let req = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req) { err in
            if err != nil { DispatchQueue.main.async { self.notifyViaScript(title: title, text: text) } }
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let panel = response.notification.request.content.userInfo["panel"] as? String
        DispatchQueue.main.async {
            self.showWindow()
            self.openPanel(panel)
        }
        completionHandler()
    }

    // Yedek yol (bildirim izni yoksa): "Script Editor" adıyla gelir, tıklanınca bir şey açmaz.
    func notifyViaScript(title: String, text: String) {
        let t = title.replacingOccurrences(of: "\"", with: "”").replacingOccurrences(of: "\\", with: "")
        let b = text.replacingOccurrences(of: "\"", with: "”").replacingOccurrences(of: "\\", with: "")
        let script = "display notification \"\(b)\" with title \"\(t)\" sound name \"Glass\""
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
        p.arguments = ["-e", script]
        try? p.run()
    }

    // MARK: - SocialBlade penceresi
    func openSocialBlade(_ username: String) {
        let clean = username.trimmingCharacters(in: CharacterSet(charactersIn: "@ \t\n")).lowercased()
        guard !clean.isEmpty,
              let enc = clean.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
              let url = URL(string: "https://socialblade.com/instagram/user/\(enc)") else { return }

        if sbWindow == nil {
            let cfg = WKWebViewConfiguration()
            cfg.websiteDataStore = .default()
            let wv = WKWebView(frame: NSRect(x: 0, y: 0, width: 1040, height: 820), configuration: cfg)
            wv.customUserAgent = UA
            wv.uiDelegate = self
            sbWebView = wv
            let w = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 1040, height: 820),
                styleMask: [.titled, .closable, .miniaturizable, .resizable],
                backing: .buffered, defer: false
            )
            w.contentView = wv
            w.isReleasedWhenClosed = false
            w.center()
            sbWindow = w
        }
        sbWindow?.title = "SocialBlade · @\(clean)"
        sbWebView?.load(URLRequest(url: url))
        sbWindow?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: - WKUIDelegate (alert / confirm / prompt / yeni pencere)
    func webView(_ wv: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert()
        a.messageText = "Instagram Takip Denetimi"
        a.informativeText = message
        a.addButton(withTitle: "Tamam")
        a.runModal()
        completionHandler()
    }

    func webView(_ wv: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert()
        a.messageText = "Onay"
        a.informativeText = message
        a.addButton(withTitle: "Evet, devam")
        a.addButton(withTitle: "Vazgeç")
        completionHandler(a.runModal() == .alertFirstButtonReturn)
    }

    func webView(_ wv: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let a = NSAlert()
        a.messageText = prompt
        let tf = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        tf.stringValue = defaultText ?? ""
        a.accessoryView = tf
        a.addButton(withTitle: "Tamam")
        a.addButton(withTitle: "Vazgeç")
        completionHandler(a.runModal() == .alertFirstButtonReturn ? tf.stringValue : nil)
    }

    // target=_blank / window.open → TEK yeniden kullanılan pencerede aç.
    // nil döneriz ki WebKit kendi (boş kalabilen) penceresini AÇMASIN — boş kare pencere sorunu bunu önler.
    func webView(_ wv: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, let s = url.scheme, s.hasPrefix("http") {
            openAux(url)
        }
        return nil
    }

    // Profil linkleri vb. için tek, yeniden kullanılan pencere.
    func openAux(_ url: URL) {
        if auxWindow == nil {
            let cfg = WKWebViewConfiguration()
            cfg.websiteDataStore = .default()
            let wv = WKWebView(frame: NSRect(x: 0, y: 0, width: 1040, height: 820), configuration: cfg)
            wv.customUserAgent = UA
            wv.uiDelegate = self
            wv.allowsBackForwardNavigationGestures = true
            auxWebView = wv
            let w = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 1040, height: 820),
                styleMask: [.titled, .closable, .miniaturizable, .resizable],
                backing: .buffered, defer: false
            )
            w.title = "Instagram"
            w.contentView = wv
            w.isReleasedWhenClosed = false
            w.center()
            auxWindow = w
        }
        auxWebView?.load(URLRequest(url: url))
        auxWindow?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: - Uygulama menüsü
    private func buildMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appItem.submenu = appMenu
        appMenu.addItem(withTitle: "Paneli Göster", action: #selector(showPanelMenu), keyEquivalent: "1")
        appMenu.addItem(withTitle: "Instagram'ı Göster", action: #selector(showInstagram), keyEquivalent: "2")
        appMenu.addItem(withTitle: "SocialBlade Ara…", action: #selector(socialBladePrompt), keyEquivalent: "b")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Ayarlar…", action: #selector(showSettings), keyEquivalent: ",")
        appMenu.addItem(withTitle: "Gizlilik ve Güvenlik…", action: #selector(showPrivacy), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Çıkış", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "Düzenle")
        editItem.submenu = editMenu
        editMenu.addItem(withTitle: "Geri Al", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Yinele", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Kes", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Kopyala", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Yapıştır", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Tümünü Seç", action: #selector(NSResponder.selectAll(_:)), keyEquivalent: "a")

        NSApp.mainMenu = mainMenu
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
