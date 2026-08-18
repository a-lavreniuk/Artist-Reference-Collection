import { createPortal } from 'react-dom';

const CURSOR_ICON = '/ui/icons/message/message-cursor.svg';

type Props = {
  x: number;
  y: number;
};

/** Курсор режима комментария: картинка 24×24, как файл иконки и как пипетка. */
export default function CardDetailCommentCursor({ x, y }: Props) {
  return createPortal(
    <img
      className="arc-card-detail-annot-cursor"
      src={CURSOR_ICON}
      alt=""
      width={24}
      height={24}
      draggable={false}
      style={{ left: x, top: y }}
    />,
    document.body
  );
}
