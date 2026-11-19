import {Check} from 'lucide-react';

export function VerifiedBadge({size=14}:{size?:number}){
 return <Check size={size} aria-label="Подтверждённый аккаунт" title="Подтверждённый аккаунт" className="inline-block shrink-0 align-[-2px] text-neutral-700"/>;
}
