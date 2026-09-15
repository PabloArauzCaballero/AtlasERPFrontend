import { AccountingDocumentScreen } from '@/components/screens/AccountingDocumentScreen';

/**
 * Alta de un asiento, en su propia página.
 *
 * No vuelve sola al listado al guardar: guardar deja un BORRADOR y el paso siguiente
 * —«Contabilizar»— se hace aquí mismo. Las migas de pan llevan de vuelta a los documentos.
 */
export default function NewAccountingDocumentPage() {
  return <AccountingDocumentScreen />;
}
