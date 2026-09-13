import {Button} from '../components/Button.jsx';
import {EmptyState} from '../components/EmptyState.jsx';
import {Link} from '../components/Link.jsx';
import {useDocumentTitle} from '../hooks/useDocumentTitle.js';

export function NotFoundPage() {
  useDocumentTitle('Not found');
  return <EmptyState title="That page does not exist." action={<Button as={Link} to="/" variant="ghost">Back to overview</Button>}>Check the address, or head back to your library.</EmptyState>;
}
