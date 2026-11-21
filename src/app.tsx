import type React from 'react';
import {createElement} from 'react';
import {lazy,Suspense,useEffect,useState} from 'react';
import {Navigate,Route,Routes,useLocation} from 'react-router-dom';
import {AppShell} from '@/components/layout/app-shell';
import {supabase} from '@/lib/supabase';
import {Toaster} from 'sonner';

const DashboardPage=lazy(()=>import('@/pages/dashboard').then(m=>({default:m.DashboardPage})));
const AuthPage=lazy(()=>import('@/pages/auth').then(m=>({default:m.AuthPage})));
const PrivacyPage=lazy(()=>import('@/pages/privacy').then(m=>({default:m.PrivacyPage})));
const SocialPage=lazy(()=>import('@/pages/social').then(m=>({default:m.SocialPage})));
const SearchPage=lazy(()=>import('@/pages/search').then(m=>({default:m.SearchPage})));
const NotificationsPage=lazy(()=>import('@/pages/notifications').then(m=>({default:m.NotificationsPage})));
const ProfilePage=lazy(()=>import('@/pages/profile').then(m=>({default:m.ProfilePage})));
const EventsPage=lazy(()=>import('@/pages/events').then(m=>({default:m.EventsPage})));
const CommunitiesPage=lazy(()=>import('@/pages/communities').then(m=>({default:m.CommunitiesPage})));
const MarketPage=lazy(()=>import('@/pages/market').then(m=>({default:m.MarketPage})));
const MarketItemPage=lazy(()=>import('@/pages/market').then(m=>({default:m.MarketItemPage})));
const AdminPage=lazy(()=>import('@/pages/admin').then(m=>({default:m.AdminPage})));
const SettingsPage=lazy(()=>import('@/pages/simple-pages').then(m=>({default:m.SettingsPage})));

const MessagesPage=lazy(()=>import('@/pages/simple-pages').then(m=>({default:()=>createElement(m.PlaceholderPage,{title:'Сообщения',description:'Личные диалоги и переписки.'})})));

function PageLoader(){return <div className="flex min-h-[45vh] items-center justify-center text-sm text-neutral-400" role="status">Загрузка KYRO…</div>}
function Protected({children}:{children:React.ReactNode}){
 const [ready,setReady]=useState(false);const [ok,setOk]=useState(false);const loc=useLocation();
 useEffect(()=>{if(!supabase){setReady(true);return}supabase.auth.getSession().then(({data})=>{setOk(Boolean(data.session));setReady(true)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setOk(Boolean(s));setReady(true)});return()=>subscription.unsubscribe()},[]);
 if(!ready)return <PageLoader/>;if(!ok)return <Navigate to="/login" replace state={{from:loc}}/>;return <>{children}</>;
}
export default function App(){
 return <><Routes>
  <Route path="/login" element={<Suspense fallback={<PageLoader/>}><AuthPage/></Suspense>}/><Route path="/privacy" element={<Suspense fallback={<PageLoader/>}><PrivacyPage/></Suspense>}/>
  <Route element={<Protected><AppShell/></Protected>}>
   <Route index element={<Suspense fallback={<PageLoader/>}><DashboardPage/></Suspense>}/><Route path="/social" element={<Suspense fallback={<PageLoader/>}><SocialPage/></Suspense>}/>
   <Route path="/market" element={<Suspense fallback={<PageLoader/>}><MarketPage/></Suspense>}/><Route path="/market/:id" element={<Suspense fallback={<PageLoader/>}><MarketItemPage/></Suspense>}/><Route path="/communities" element={<Suspense fallback={<PageLoader/>}><CommunitiesPage/></Suspense>}/><Route path="/communities/:slug" element={<Suspense fallback={<PageLoader/>}><CommunitiesPage/></Suspense>}/><Route path="/events" element={<Suspense fallback={<PageLoader/>}><EventsPage/></Suspense>}/>
   <Route path="/messages" element={<Suspense fallback={<PageLoader/>}><MessagesPage/></Suspense>}/><Route path="/notifications" element={<Suspense fallback={<PageLoader/>}><NotificationsPage/></Suspense>}/>
   <Route path="/search" element={<Suspense fallback={<PageLoader/>}><SearchPage/></Suspense>}/><Route path="/profile" element={<Suspense fallback={<PageLoader/>}><ProfilePage/></Suspense>}/>
   <Route path="/u/:username" element={<Suspense fallback={<PageLoader/>}><ProfilePage/></Suspense>}/><Route path="/settings" element={<Suspense fallback={<PageLoader/>}><SettingsPage/></Suspense>}/>
   <Route path="/admin" element={<Suspense fallback={<PageLoader/>}><AdminPage/></Suspense>}/>
   <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route>
 </Routes><Toaster position="top-right"/></>;
}
