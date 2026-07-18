# Arquivo CN — as duas formas de ter no iPad Pro 12,9" (M2)

Este diretório entrega **as duas opções** para usar o Arquivo CN como app no
iPad, com a lousa "Explicação ativa" por **Apple Pencil** funcionando.

---

## Opção 1 — PWA (funciona agora, sem Mac, sem Xcode)

A forma mais rápida. O Arquivo CN já é instalável como app de tela cheia:

1. No **Safari do iPad**, abra a página publicada `arquivo.html` do site.
2. Toque no botão **Compartilhar** → **Adicionar à Tela de Início**.
3. Confirme. Vai aparecer um ícone próprio "Arquivo CN".
4. Abra por esse ícone: roda em **tela cheia**, sem a barra do Safari.

A lousa com Apple Pencil (pressão real e rejeição de palma) já funciona,
porque a WebView do iOS é a mesma engine do Safari. O progresso fica salvo no
próprio aparelho (localStorage). Metatags e `manifest-arquivo.webmanifest` já
estão configurados no `docs/`.

> A PWA precisa ser servida por HTTPS (o site publicado). Não instala a partir
> de um arquivo solto `file://`.

---

## Opção 2 — App nativo (SwiftUI) para instalar via sideload

Projeto Xcode completo em **`ArquivoCN/`**. Ele embute o Arquivo CN inteiro
(HTML + dados + as figuras oficiais, ~4 MB) e o carrega numa `WKWebView`
configurada para Apple Pencil. **Funciona 100% offline** dentro do app.

### Requisitos
- Um **Mac com Xcode 15+** (compilar/assinar `.ipa` exige o toolchain da Apple;
  não há como gerar um `.ipa` instalável fora do macOS).
- Uma conta Apple (a **gratuita** já serve para instalar no seu próprio iPad).

### Passo a passo
1. Abra **`ios/ArquivoCN/ArquivoCN.xcodeproj`** no Xcode.
2. Selecione o target **ArquivoCN** → aba **Signing & Capabilities**:
   - Marque **Automatically manage signing**.
   - Em **Team**, escolha seu Apple ID (adicione em Xcode ▸ Settings ▸ Accounts).
   - Troque o **Bundle Identifier** para algo único seu, ex.:
     `com.SEUNOME.arquivocn` (o `com.arquivocn.enem` pode já estar em uso).
3. Conecte o **iPad Pro 12,9"** por cabo e selecione-o como destino no topo.
4. Aperte **Run (⌘R)**. O Xcode compila, instala e abre no iPad.
   - Na primeira vez, o iPad pede para **confiar no desenvolvedor**:
     Ajustes ▸ Geral ▸ VPN e Gerenciamento de Dispositivos ▸ confie no seu Apple ID.
5. Pronto — app nativo, tela cheia, Apple Pencil, offline.

### Gerar um `.ipa` para sideload (Sideloadly/AltStore)
No Xcode: **Product ▸ Archive** → **Distribute App** → **Debugging** (ou
**Development**) → exporta um `.ipa` assinado com seu perfil. Esse `.ipa` é o que
você carrega no Sideloadly. (Um `.ipa` não assinado o iOS recusa a instalar —
por isso a assinatura no Xcode é obrigatória.)

### Estrutura do projeto
```
ios/ArquivoCN/
├─ ArquivoCN.xcodeproj/          projeto Xcode
└─ ArquivoCN/
   ├─ ArquivoCNApp.swift         @main, cena em tela cheia
   ├─ ContentView.swift          hospeda a WebView
   ├─ WebView.swift              WKWebView carregando web/index.html (offline)
   ├─ Info.plist                 orientações do iPad, status bar oculta
   ├─ Assets.xcassets            ícone do app + cor de destaque (azul Klein)
   └─ web/                        Arquivo CN embutido (HTML + figuras)
```

### Observações honestas
- A WebView recebe os eventos do Apple Pencil **com a pressão real**, então a
  lousa funciona igual à web. Para uma experiência de escrita ainda mais nativa,
  dá para reimplementar a lousa em **PencilKit** — posso escrever esse módulo se
  você quiser, mas a versão via WebView já entrega o recurso pedido.
- A exportação CSV usa download do navegador; dentro do app nativo o ideal é
  abrir a folha de compartilhamento do iOS — dá para adicionar depois se precisar.
- **Não compilo o `.ipa` aqui**: este ambiente é Linux, sem Xcode. Eu entrego o
  **código-fonte do projeto**, que compila direto no seu Mac/Xcode.
