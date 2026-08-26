/*
 * Cliente, y no servidor, porque esta pagina pasa una FUNCION (`load`) a `RecordsPanel`.
 *
 * Un componente de servidor no puede pasar una funcion a uno de cliente —hay que serializarla para
 * cruzar el limite y una funcion no se serializa—, asi que el prerender fallaba con «Functions
 * cannot be passed directly to Client Components» y tumbaba la construccion entera. Sus hermanas de
 * CRM que hacen lo mismo ya lo declaraban; estas dos se quedaron atras.
 */
'use client';

import { ProposalManagerScreen } from '@/components/screens/ProposalManagerScreen';
import { RecordsPanel } from '@/components/screens/RecordsPanel';
import { b2bService } from '@/services/b2bService';

export default function ProposalsPage() {
  return (
    <div className="space-y-5">
      <RecordsPanel title="Propuestas comerciales" load={b2bService.listProposals} emptyHint="Arma la primera propuesta con el constructor de abajo." />
      <ProposalManagerScreen />
    </div>
  );
}
