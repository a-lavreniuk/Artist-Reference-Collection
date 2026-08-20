import { useState } from 'react';
import LinkInput from '../components/ui/LinkInput';
import { parseLinkInput } from '../utils/linkInput';

function openDemoLink(raw: string) {
  const { protocol, host } = parseLinkInput(raw);
  if (!host) return;
  window.open(`${protocol}${host}`, '_blank', 'noopener,noreferrer');
}

export default function UiKitLinkInputDemo() {
  const [empty, setEmpty] = useState('');
  const [filled, setFilled] = useState('https://example.com');

  return (
    <div className="inputs-column">
      <LinkInput
        value={empty}
        onChange={setEmpty}
        ariaLabel="Ссылка"
        onOpen={() => openDemoLink(empty)}
        canOpen={Boolean(parseLinkInput(empty).host)}
      />
      <LinkInput
        value={filled}
        onChange={setFilled}
        ariaLabel="Ссылка"
        onOpen={() => openDemoLink(filled)}
        canOpen={Boolean(parseLinkInput(filled).host)}
      />
      <LinkInput value="https://example.com" onChange={() => undefined} disabled ariaLabel="Ссылка" />
    </div>
  );
}
