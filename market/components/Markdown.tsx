import ReactMarkdown from "react-markdown";

// Description mise en forme (Markdown : titres, listes, gras, liens…).
// Le HTML brut est ignoré par react-markdown : un vendeur ne peut pas injecter de code dans la page.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        components={{
          // Liens externes : nouvel onglet, sans transmettre la page d'origine ni booster le référencement du lien
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
              {children}
            </a>
          ),
          // Pas d'images dans la description (elles vont dans la galerie)
          img: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
