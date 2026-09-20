type ContentHtmlProps = {
  html: string;
};

export function ContentHtml({ html }: ContentHtmlProps) {
  return <div className="content-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
