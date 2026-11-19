import type React from 'react';
import {lazy,Suspense,useEffect,useState} from 'react';
import {Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {AppShell} from '@/components/layout/app-shell';
import {supabase} from '@/lib/supabase';
import {Toaster} from 'sonner';

const DashboardPage=lazy(()=>import('@/pages/dashboard').then(m=>({default:m.DashboardPage})));
const AuthPage=lazy(()=>import('@/pages/auth').then(m=>({default:m.AuthPage})));
const PrivacyPage=lazy(()=>import('@/pages/privacy').then(m=>({default:m.PrivacyPage})));
const SimplePages=lazy(()=>import('@/pages/simple-pages').then(m=>({default:()=>null})));
const SocialPage=lazy(()=>import('@/pages/social').then(m=>({default:m.SocialPage})));
const SearchPage=lazy(()=>import('@/pages/search').then(m=>({default:m.SearchPage})));
const NotificationsPage=lazy(()=>import('@/pages/notifications').then(m=>({default:m.NotificationsPage})));
const ProfilePage=lazy(()=>import('@/pages/profile').then(m=>({default:m.ProfilePage})));
const EventsPage=lazy(()=>import('@/pages/events').then(m=>({default:m.EventsPage})));
const AdminPage=lazy(()=>import('@/pages/admin').then(m=>({default:m.AdminPage})));
const PremiumPage=lazy(()=>import('@/pages/premium').then(m=>({default:m.PremiumPage})));
const SettingsPage=lazy(()=>import('@/pages/simple-pages').then(m=>({default:m.SettingsPage})));
const MarketPage=lazy(()=>import('@/pages/simple-pages').then(m=>({default:()=>m.PlaceholderPage({title:'Market',description:'Каталог товаров и объявления сообщества.'})})));
const MessagesPage=lazy(()=>import('@/pages/simple-pages').then(m=>({default:()=>m.PlaceholderPage({title:'Сообщения',description:'Личные диалоги и переписки.'})})));

function PageLoader(){return <div className="flex min-h-[45vh] items-center justify-center text-sm text-neutral-400" role="status">Загрузка KYRO…</div>}
function Protected({children}:{children:React.ReactNode}){
 const [ready,setReady]=useState(false);const [ok,setOk]=useState(false);const loc=useLocation();
 useEffect(()=>{if(!supabase){setReady(true);return}supabase.auth.getSession().then(({data})=>{setOk(Boolean(data.session));setReady(true)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setOk(Boolean(s));setReady(true)});return()=>subscription.unsubscribe()},[]);
 if(!ready)return <PageLoader/>;if(!ok)return <Navigate to="/login" replace state={{from:loc}}/>;return <>{children}</>;
}
export default function App(){
 return <Suspense fallback={<PageLoader/>}><Routes>
  <Route path="/login" element={<AuthPage/>}/><Route path="/privacy" element={<PrivacyPage/>}/>
  <Route element={<Protected><AppShell/></Protected>}>
   <Route index element={<DashboardPage/>}/><Route path="/social" element={<SocialPage/>}/>
   <Route path="/market" element={<MarketPage/>}/><Route path="/events" element={<EventsPage/>}/>
   <Route path="/messages" element={<MessagesPage/>}/><Route path="/notifications" element={<NotificationsPage/>}/>
   <Route path="/search" element={<SearchPage/>}/><Route path="/profile" element={<ProfilePage/>}/>
   <Route path="/u/:username" element={<ProfilePage/>}/><Route path="/settings" element={<SettingsPage/>}/>
   <Route path="/premium" element={<PremiumPage/>}/><Route path="/admin" element={<AdminPage/>}/>
   <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route>
 </Routes><Toaster position="top-right"/></Suspense>;
}
