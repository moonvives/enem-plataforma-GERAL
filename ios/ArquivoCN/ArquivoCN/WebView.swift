import SwiftUI
import WebKit

// Envolve o Arquivo CN (HTML autocontido embutido no app) em uma WKWebView.
// A WKWebView recebe os eventos de ponteiro do Apple Pencil já com a pressão
// real (pointerType "pen", event.pressure), então a lousa "Explicação ativa"
// funciona nativamente, sem precisar reimplementar em PencilKit.
struct WebView: UIViewRepresentable {

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.suppressesIncrementalRendering = false
        // Sem seleção/lupa atrapalhando a escrita à mão:
        let prefs = WKPreferences()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.preferences = prefs

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = true
        web.backgroundColor = .white
        web.scrollView.backgroundColor = .white
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = true
        // O Apple Pencil deve desenhar na lousa em vez de rolar a página;
        // o próprio HTML usa touch-action:none no canvas, isto complementa.
        web.allowsBackForwardNavigationGestures = false

        loadLocalSite(into: web)
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private func loadLocalSite(into web: WKWebView) {
        // index.html vive em Resources/web/ (referência de pasta no bundle),
        // com as figuras em web/assets/img/modelos/.
        guard let indexURL = Bundle.main.url(
            forResource: "index", withExtension: "html", subdirectory: "web"
        ) else {
            web.loadHTMLString(
                "<h2 style='font-family:-apple-system;padding:40px'>Recurso web não encontrado no bundle. "
                + "Confirme que a pasta <b>web</b> foi adicionada como referência de pasta (folder reference).</h2>",
                baseURL: nil)
            return
        }
        let webDir = indexURL.deletingLastPathComponent()
        web.loadFileURL(indexURL, allowingReadAccessTo: webDir)
    }
}
