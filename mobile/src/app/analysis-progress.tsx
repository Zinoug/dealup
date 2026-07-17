import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { BarChart3, Check, FileSearch, Image as ImageIcon, ShieldCheck, Timer } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { AppLogo } from '@/components/app-logo';
import { DeviceThumbnail } from '@/components/device-thumbnail';
import { BottomDock, DarkSafeScreen, GlassCard, SourcePill } from '@/components/reference-ui';
import { useAppStore } from '@/store/app-store';
import { colors, layout, type } from '@/theme/tokens';

const steps = [{ label:'Lecture de l’annonce', detail:'Extraction des informations clés…', icon:FileSearch },{ label:'Inspection des photos',detail:'Analyse des images et détection d’incohérences…',icon:ImageIcon},{label:'Estimation du juste prix',detail:'Comparaison avec le marché actuel…',icon:BarChart3},{label:'Verdict et plan d’action',detail:'Préparation de tes recommandations…',icon:ShieldCheck}];
export default function ProgressScreen(){
  const { id, preview }=useLocalSearchParams<{id:string;preview?:string}>(); const { completeAnalysis, identification }=useAppStore(); const [step,setStep]=useState(0); const {height}=useWindowDimensions();
  const device = identification?.compatibility?.device;
  useEffect(()=>{const timer=setInterval(()=>setStep(v=>Math.min(3,v+1)),preview==='1'?1500:900);return()=>clearInterval(timer)},[preview]);
  useEffect(()=>{if(!id)return;let alive=true;let revealTimer:ReturnType<typeof setTimeout>|undefined;Promise.all([completeAnalysis(id),new Promise(resolve=>setTimeout(resolve,preview==='1'?7000:3500))]).then(([r])=>{if(r&&alive){setStep(4);void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);revealTimer=setTimeout(()=>router.replace({pathname:'/analysis/[id]',params:{id:r.id,reveal:'1'}}),720)}});return()=>{alive=false;if(revealTimer)clearTimeout(revealTimer)}},[completeAnalysis,id,preview]);
  return <DarkSafeScreen variant="beams" edges={['top','left','right','bottom']} style={styles.screen}>
    <PulsingDealupLogo size={height>850?122:96} />
    <Text style={styles.title}>On soulève{`\n`}<Text style={styles.lime}>chaque détail.</Text></Text>
    <GlassCard style={styles.listing}><DeviceThumbnail category={device?.category} size={58}/><View style={styles.listingCopy}><Text numberOfLines={1} style={styles.product}>{device?.displayName ?? identification?.title ?? 'Annonce identifiée'}</Text><Text style={styles.meta}>{identification ? `${Math.round(identification.priceCents / 100).toLocaleString('fr-FR')} € · ${identification.location}` : 'Leboncoin'}</Text><Text style={styles.identified}>◉  Annonce Leboncoin identifiée</Text></View>{height>850?<SourcePill/>:null}</GlassCard>
    <View style={styles.steps}>{steps.map((item,index)=>{const done=index<step,current=index===step,Icon=item.icon;return <View key={item.label} style={[styles.step,done&&styles.completedStep]}><View style={styles.rail}>{index<3?<View style={[styles.vertical,done&&styles.verticalDone]}/>:null}<View style={[styles.circle,done&&styles.done,current&&styles.current]}>{done?<Check size={17} color={colors.brand900} strokeWidth={3.4}/>:<Icon size={17} color={current?colors.lime:colors.inkSoft}/>}</View></View><View style={styles.stepCopy}><Text style={[styles.stepLabel,done&&styles.completedLabel,!done&&!current&&styles.future,current&&styles.currentLabel]}>{item.label}</Text>{current||height>850?<Text style={[styles.stepDetail,done&&styles.completedDetail,current&&styles.activeDetail]}>{item.detail}</Text>:null}</View></View>})}</View>
    <View style={styles.timer}><Timer size={21} color={colors.lime}/><Text style={styles.timerText}>Cela prend généralement moins de 30 secondes.</Text></View>
    {height>880?<BottomDock/>:null}
  </DarkSafeScreen>
}

function PulsingDealupLogo({ size }: { size: number }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })), -1);
  }, [pulse]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [0, 1], [.28, .72]), transform: [{ scale: interpolate(pulse.value, [0, 1], [.88, 1.12]) }] }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(pulse.value, [0, 1], [.985, 1.015]) }] }));
  return <View style={[styles.logoStage,{height:size+38}]}><Animated.View style={[styles.logoGlow,{width:size*1.45,height:size*1.45,borderRadius:size},glowStyle]}><LinearGradient colors={['rgba(196,245,42,.48)','rgba(18,198,93,.22)','rgba(0,87,55,0)']} style={StyleSheet.absoluteFill}/></Animated.View><Animated.View style={logoStyle}><AppLogo size={size} elevated /></Animated.View><Text style={styles.wordmark}>Deal<Text style={styles.lime}>Up</Text></Text></View>;
}

const styles=StyleSheet.create({screen:{paddingHorizontal:layout.gutter,paddingTop:16,paddingBottom:18},logoStage:{alignItems:'center',justifyContent:'flex-start'},logoGlow:{position:'absolute',top:-10,overflow:'hidden',shadowColor:colors.lime,shadowOpacity:.55,shadowRadius:25},wordmark:{color:colors.white,fontSize:25,lineHeight:30,fontWeight:'700',letterSpacing:-1,marginTop:1},title:{...type.h1,color:colors.white,textAlign:'center',marginTop:14},lime:{color:colors.lime},listing:{marginTop:16,flexDirection:'row',alignItems:'center',gap:10,padding:10},listingCopy:{flex:1},product:{color:colors.white,fontSize:13,fontWeight:'600'},meta:{color:colors.inkMuted,fontSize:11,marginTop:2},identified:{color:colors.lime,fontSize:8,marginTop:5},steps:{marginTop:15},step:{minHeight:72,flexDirection:'row'},completedStep:{opacity:1},rail:{width:42,alignItems:'center'},vertical:{position:'absolute',top:31,bottom:-3,width:2,backgroundColor:'rgba(49,107,78,0.5)'},verticalDone:{backgroundColor:colors.lime,shadowColor:colors.lime,shadowOpacity:.9,shadowRadius:7},circle:{width:32,height:32,borderRadius:16,borderWidth:1,borderColor:colors.inkSoft,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand900},done:{backgroundColor:colors.lime,borderColor:'#E6FF77',borderWidth:1.5,shadowColor:colors.lime,shadowOpacity:1,shadowRadius:12,elevation:7},current:{borderColor:colors.lime,borderWidth:2,shadowColor:colors.lime,shadowOpacity:.85,shadowRadius:11},stepCopy:{flex:1,paddingLeft:8,paddingTop:3},stepLabel:{color:colors.white,fontSize:15,fontWeight:'600'},completedLabel:{color:'#F8FFF2',fontWeight:'700',textShadowColor:'rgba(196,245,42,.42)',textShadowRadius:8},currentLabel:{color:colors.lime},future:{color:colors.inkSoft},stepDetail:{color:colors.inkSoft,fontSize:10,marginTop:4},completedDetail:{color:'#AFC9B9'},activeDetail:{color:colors.lime},timer:{marginTop:'auto',paddingBottom:6,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},timerText:{color:colors.inkMuted,fontSize:12}});
