import { useState } from 'react';
import LinkInput from '../components/ui/LinkInput';
import { toOpenableLinkUrl } from '../utils/linkInput';

function openDemoLink(raw: string) {
  const url = toOpenableLinkUrl(raw);
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function UiKitLinkInputDemo() {
  const [empty, setEmpty] = useState('');
  const [filled, setFilled] = useState('https://example.com');
  const [invalid, setInvalid] = useState('not-a-link');

  return (
    <div className="inputs-column">
      <LinkInput
        value={empty}
        onChange={setEmpty}
        ariaLabel="Ссылка"
        onOpen={() => openDemoLink(empty)}
        canOpen={Boolean(toOpenableLinkUrl(empty))}
      />
      <LinkInput
        value={filled}
        onChange={setFilled}
        ariaLabel="Ссылка"
        onOpen={() => openDemoLink(filled)}
        canOpen={Boolean(toOpenableLinkUrl(filled))}
      />
      <LinkInput
        value={invalid}
        onChange={setInvalid}
        ariaLabel="Ссылка с ошибкой"
        onOpen={() => openDemoLink(invalid)}
        canOpen={Boolean(toOpenableLinkUrl(invalid))}
      />
      <LinkInput value="https://example.com" onChange={() => undefined} disabled ariaLabel="Ссылка" />
    </div>
  );
}
