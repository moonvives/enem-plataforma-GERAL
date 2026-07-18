import SwiftUI

// Ponto de entrada do app. Uma única cena em tela cheia, pensada para o
// iPad Pro 12,9" (M2) em qualquer orientação, com escrita por Apple Pencil.
@main
struct ArquivoCNApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .ignoresSafeArea()                 // tela ampla, sem margens
                .statusBarHidden(true)
                .preferredColorScheme(.light)      // o Arquivo CN é claro por design
        }
    }
}
