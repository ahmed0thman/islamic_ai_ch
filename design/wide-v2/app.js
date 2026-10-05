/* Huda wide reader v2 (desktop prototype, no build step, no libraries).
   Content comes from content/export/surah-<no>.json, interface strings from content/ui.ar.json.
   No ayah text, explanation sentence or source quote is written in this file.
   The only Arabic written here is the STR object below: interface labels that content/ui.ar.json does not carry yet. */
'use strict';

/* ---------------------------------------------------------------- new strings (to be moved to content/ui.ar.json) */
const STR = {
  skip: 'انتقل إلى نص الشرح',
  toc: 'فهرس السورة',
  purpose: 'مقصد السورة',
  ayah_one: 'آية',
  ayah_few: 'آيات',
  tab_passage: 'المقطع',
  tab_term: 'المصطلح',
  tab_weave: 'نسيج لك',
  passage_sources: 'مصادر هذا المقطع',
  all_sources: 'كل المصادر',
  source_hint: 'اضغط العلامة بعد أي جملة ليظهر مصدرها هنا: نصه الحرفي، وكتابه، وحالته.',
  term_hint: 'اضغط أي مصطلح تحته خط منقّط ليظهر معناه هنا.',
  weave_empty: 'اسأل أولًا في تبويب «اسأل»، ثم انسج الوقفة على أسئلتك.',
  weave_static: 'النسج يحتاج المساعد الحي. هذا نموذج ثابت لتخطيط الشاشة.',
  shortcuts: 'اختصارات لوحة المفاتيح',
  theme_dark: 'الوضع الليلي',
  theme_light: 'الوضع الفاتح',
  account: 'الحساب',
  panel_hide: 'اطوِ لوحة السياق',
  panel_show: 'افتح لوحة السياق',
  expand_all: 'افتح كل البنود',
  collapse_all: 'اطوِ كل البنود',
  narrow: 'هذا نموذج الشاشة العريضة. افتحه على شاشة عرضها ١٠٢٤ بكسل أو أكثر. شاشة الجوال موجودة في التطبيق.',
  load_failed: 'تعذّر تحميل السورة.'
};

/* ---------------------------------------------------------------- icons (Hugeicons free, MIT; paths copied from the installed package @hugeicons/core-free-icons) */
const ICONS = {"Quran03":[["path",{"d":"M14.9336 11.0007C14.3683 11.9389 13.3396 12.5664 12.1644 12.5664C10.3801 12.5664 8.93359 11.1199 8.93359 9.33564C8.93359 8.16041 9.56109 7.13174 10.4993 6.56641"}],["path",{"d":"M20 22H6C4.89543 22 4 21.1046 4 20M4 20C4 18.8954 4.89543 18 6 18H20V6C20 4.11438 20 3.17157 19.4142 2.58579C18.8284 2 17.8856 2 16 2H10C7.17157 2 5.75736 2 4.87868 2.87868C4 3.75736 4 5.17157 4 8V20Z"}],["path",{"d":"M19.5 18C19.5 18 18.5 18.7628 18.5 20C18.5 21.2372 19.5 22 19.5 22"}],["path",{"d":"M13.625 8H13.5M13.75 8C13.75 8.13807 13.6381 8.25 13.5 8.25C13.3619 8.25 13.25 8.13807 13.25 8C13.25 7.86193 13.3619 7.75 13.5 7.75C13.6381 7.75 13.75 7.86193 13.75 8Z"}]],"QuoteDown":[["path",{"d":"M10 8C10 9.88562 10 10.8284 9.41421 11.4142C8.82843 12 7.88562 12 6 12C4.11438 12 3.17157 12 2.58579 11.4142C2 10.8284 2 9.88562 2 8C2 6.11438 2 5.17157 2.58579 4.58579C3.17157 4 4.11438 4 6 4C7.88562 4 8.82843 4 9.41421 4.58579C10 5.17157 10 6.11438 10 8Z"}],["path",{"d":"M10 7L10 11.4821C10 15.4547 7.48429 18.8237 4 20"}],["path",{"d":"M22 8C22 9.88562 22 10.8284 21.4142 11.4142C20.8284 12 19.8856 12 18 12C16.1144 12 15.1716 12 14.5858 11.4142C14 10.8284 14 9.88562 14 8C14 6.11438 14 5.17157 14.5858 4.58579C15.1716 4 16.1144 4 18 4C19.8856 4 20.8284 4 21.4142 4.58579C22 5.17157 22 6.11438 22 8Z"}],["path",{"d":"M22 7L22 11.4821C22 15.4547 19.4843 18.8237 16 20"}]],"Footprints":[["path",{"d":"M10.535 10.2187L9.99444 12.4393C9.746 13.4599 9.62179 13.9701 9.24607 14.2823C9.21466 14.3084 9.18215 14.3333 9.14863 14.3568C8.74779 14.6384 8.20467 14.6384 7.11844 14.6384H6.44056C5.71535 14.6384 5.35274 14.6384 5.05823 14.5126C4.7893 14.3978 4.56057 14.2103 4.39963 13.9727C4.22339 13.7125 4.16475 13.3672 4.04748 12.6765L3.5637 9.8272C3.16319 7.46831 4.68869 5.20279 7.08482 4.59797L7.29168 4.54575C8.7774 4.17073 10.2847 5.07654 10.5916 6.52879C10.8492 7.74826 10.8299 9.00715 10.535 10.2187Z"}],["path",{"d":"M5.48863 17.5793H8.32119C8.93314 17.5793 9.42923 18.0581 9.42923 18.6487V19.0641C9.42923 20.4096 8.29905 21.5004 6.90491 21.5004C5.51077 21.5004 4.38059 20.4096 4.38059 19.0641V18.6487C4.38059 18.0581 4.87668 17.5793 5.48863 17.5793Z"}],["path",{"d":"M13.463 8.25779L14.0036 10.4784C14.252 11.4989 14.3763 12.0092 14.752 12.3214C14.7834 12.3475 14.8159 12.3724 14.8494 12.3959C15.2502 12.6775 15.7934 12.6775 16.8796 12.6775H17.5575C18.2827 12.6775 18.6453 12.6775 18.9398 12.5517C19.2087 12.4368 19.4375 12.2493 19.5984 12.0118C19.7747 11.7516 19.8333 11.4063 19.9506 10.7156L20.4343 7.86626C20.8348 5.50737 19.3094 3.24185 16.9132 2.63703L16.7064 2.58482C15.2206 2.20979 13.7133 3.1156 13.4065 4.56785C13.1488 5.78732 13.1681 7.04621 13.463 8.25779Z"}],["path",{"d":"M18.5094 15.6183H15.6769C15.0649 15.6183 14.5688 16.0971 14.5688 16.6877V17.1032C14.5688 18.4487 15.699 19.5394 17.0931 19.5394C18.4873 19.5394 19.6174 18.4487 19.6174 17.1032V16.6877C19.6174 16.0971 19.1214 15.6183 18.5094 15.6183Z"}]],"QuillWrite01":[["path",{"d":"M5.07579 17C4.08939 4.54502 12.9123 1.0121 19.9734 2.22417C20.2585 6.35185 18.2389 7.89748 14.3926 8.61125C15.1353 9.38731 16.4477 10.3639 16.3061 11.5847C16.2054 12.4534 15.6154 12.8797 14.4355 13.7322C11.8497 15.6004 8.85421 16.7785 5.07579 17Z"}],["path",{"d":"M4 22C4 15.5 7.84848 12.1818 10.5 10"}]],"Link01":[["path",{"d":"M9.14339 10.691L9.35031 10.4841C11.329 8.50532 14.5372 8.50532 16.5159 10.4841C18.4947 12.4628 18.4947 15.671 16.5159 17.6497L13.6497 20.5159C11.671 22.4947 8.46279 22.4947 6.48405 20.5159C4.50532 18.5372 4.50532 15.329 6.48405 13.3503L6.9484 12.886"}],["path",{"d":"M17.0516 11.114L17.5159 10.6497C19.4947 8.67095 19.4947 5.46279 17.5159 3.48405C15.5372 1.50532 12.329 1.50532 10.3503 3.48405L7.48405 6.35031C5.50532 8.32904 5.50532 11.5372 7.48405 13.5159C9.46279 15.4947 12.671 15.4947 14.6497 13.5159L14.8566 13.309"}]],"Compass":[["circle",{"cx":"12","cy":"13","r":"9"}],["path",{"d":"M12 3.5V2"}],["path",{"d":"M10 2H14"}],["path",{"d":"M14.7728 10.2571C15.5061 10.9837 14.3328 16.8933 13.1289 16.9974C12.1189 17.0848 11.8041 15.0928 11.5914 14.4614C11.3815 13.8383 11.1478 13.6139 10.5298 13.4095C8.95989 12.8901 8.17492 12.6304 8.0195 12.2192C7.60796 11.1304 13.8362 9.32902 14.7728 10.2571Z"}]],"Cancel01":[["path",{"d":"M18 6L6.00081 17.9992M17.9992 18L6 6.00085"}]],"ArrowLeft01":[["path",{"d":"M15 6C15 6 9.00001 10.4189 9 12C8.99999 13.5812 15 18 15 18"}]],"ArrowRight01":[["path",{"d":"M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18"}]],"ArrowUpRight01":[["path",{"d":"M9 6.65032C9 6.65032 15.9383 6.10759 16.9154 7.08463C17.8924 8.06167 17.3496 15 17.3496 15M16.5 7.5L6.5 17.5"}]],"ArrowDown01":[["path",{"d":"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"}]],"PlusSign":[["path",{"d":"M12 4V20M20 12H4"}]],"MinusSign":[["path",{"d":"M20 12L4 12"}]],"Tick02":[["path",{"d":"M5 14L8.5 17.5L19 6.5"}]],"Search01":[["path",{"d":"M17 17L21 21"}],["path",{"d":"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z"}]],"Moon02":[["path",{"d":"M21.5 14.0784C20.3003 14.7189 18.9301 15.0821 17.4751 15.0821C12.7491 15.0821 8.91792 11.2509 8.91792 6.52485C8.91792 5.06986 9.28105 3.69968 9.92163 2.5C5.66765 3.49698 2.5 7.31513 2.5 11.8731C2.5 17.1899 6.8101 21.5 12.1269 21.5C16.6849 21.5 20.503 18.3324 21.5 14.0784Z"}]],"Sun03":[["path",{"d":"M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z"}],["path",{"d":"M12 2V3.5M12 20.5V22M19.0708 19.0713L18.0101 18.0106M5.98926 5.98926L4.9286 4.9286M22 12H20.5M3.5 12H2M19.0713 4.92871L18.0106 5.98937M5.98975 18.0107L4.92909 19.0714"}]],"UserCircle":[["path",{"d":"M18.4984 19.1511C17.3377 17.4018 15.2947 16.2009 12.9313 16.0569L11.9984 16C11.6652 16.0083 11.3547 16.0194 11.0617 16.0325C8.71722 16.1376 6.66598 17.3796 5.5 19.1511"}],["path",{"d":"M14.9961 10C14.9961 11.6569 13.6529 13 11.9961 13C10.3392 13 8.99609 11.6569 8.99609 10C8.99609 8.34315 10.3392 7 11.9961 7C13.6529 7 14.9961 8.34315 14.9961 10Z"}],["path",{"d":"M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"}]],"SidebarRight":[["path",{"d":"M2 12C2 8.3109 2 6.46633 2.81382 5.1588C3.1149 4.67505 3.48891 4.2543 3.91891 3.91557C5.08116 3.00003 6.72077 3.00003 10 3.00003H14C17.2792 3.00003 18.9188 3.00003 20.0811 3.91557C20.5111 4.2543 20.8851 4.67505 21.1862 5.1588C22 6.46633 22 8.3109 22 12C22 15.6892 22 17.5337 21.1862 18.8413C20.8851 19.325 20.5111 19.7458 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7458 3.1149 19.325 2.81382 18.8413C2 17.5337 2 15.6892 2 12Z"}],["path",{"d":"M14.5 3.00003L14.5 21"}],["path",{"d":"M18 7.00006H19M18 10.0001H19"}]],"SidebarLeft":[["path",{"d":"M2 12C2 8.31087 2 6.4663 2.81382 5.15877C3.1149 4.67502 3.48891 4.25427 3.91891 3.91554C5.08116 3 6.72077 3 10 3H14C17.2792 3 18.9188 3 20.0811 3.91554C20.5111 4.25427 20.8851 4.67502 21.1862 5.15877C22 6.4663 22 8.31087 22 12C22 15.6891 22 17.5337 21.1862 18.8412C20.8851 19.325 20.5111 19.7457 20.0811 20.0845C18.9188 21 17.2792 21 14 21H10C6.72077 21 5.08116 21 3.91891 20.0845C3.48891 19.7457 3.1149 19.325 2.81382 18.8412C2 17.5337 2 15.6891 2 12Z"}],["path",{"d":"M9.5 3L9.5 21"}],["path",{"d":"M5 7H6M5 10H6"}]],"Keyboard":[["path",{"d":"M14.5 7H9.5C6.21252 7 4.56878 7 3.46243 7.90796C3.25989 8.07418 3.07418 8.25989 2.90796 8.46243C2 9.56878 2 11.2125 2 14.5C2 17.7875 2 19.4312 2.90796 20.5376C3.07418 20.7401 3.25989 20.9258 3.46243 21.092C4.56878 22 6.21252 22 9.5 22H14.5C17.7875 22 19.4312 22 20.5376 21.092C20.7401 20.9258 20.9258 20.7401 21.092 20.5376C22 19.4312 22 17.7875 22 14.5C22 11.2125 22 9.56878 21.092 8.46243C20.9258 8.25989 20.7401 8.07418 20.5376 7.90796C19.4312 7 17.7875 7 14.5 7Z"}],["path",{"d":"M12 7V5C12 4.44772 12.4477 4 13 4C13.5523 4 14 3.55228 14 3V2"}],["path",{"d":"M7 12L8 12"}],["path",{"d":"M11.5 12L12.5 12"}],["path",{"d":"M16 12L17 12"}],["path",{"d":"M7 17L17 17"}]],"Key01":[["path",{"d":"M15.5 14.5C18.8137 14.5 21.5 11.8137 21.5 8.5C21.5 5.18629 18.8137 2.5 15.5 2.5C12.1863 2.5 9.5 5.18629 9.5 8.5C9.5 9.38041 9.68962 10.2165 10.0303 10.9697L2.5 18.5V21.5H5.5V19.5H7.5V17.5H9.5L13.0303 13.9697C13.7835 14.3104 14.6196 14.5 15.5 14.5Z"}],["path",{"d":"M17.5 6.5L16.5 7.5"}]],"BubbleChatQuestion":[["path",{"d":"M21.5 12C21.5 17.2467 17.2467 21.5 12 21.5C10.3719 21.5 8.8394 21.0904 7.5 20.3687C5.63177 19.362 4.37462 20.2979 3.26592 20.4658C3.09774 20.4913 2.93024 20.4302 2.80997 20.31C2.62741 20.1274 2.59266 19.8451 2.6935 19.6074C3.12865 18.5818 3.5282 16.6382 2.98341 15C2.6698 14.057 2.5 13.0483 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5C17.2467 2.5 21.5 6.75329 21.5 12Z"}],["path",{"d":"M9.5 9.5C9.5 8.11929 10.6193 7 12 7C13.3807 7 14.5 8.11929 14.5 9.5C14.5 10.3569 14.0689 11.1131 13.4117 11.5636C12.7283 12.0319 12 12.6716 12 13.5"}],["path",{"d":"M12.125 16.75H12M12.25 16.75C12.25 16.8881 12.1381 17 12 17C11.8619 17 11.75 16.8881 11.75 16.75C11.75 16.6119 11.8619 16.5 12 16.5C12.1381 16.5 12.25 16.6119 12.25 16.75Z"}]],"Sent":[["path",{"d":"M21.0477 3.05293C18.8697 0.707363 2.48648 6.4532 2.50001 8.551C2.51535 10.9299 8.89809 11.6617 10.6672 12.1581C11.7311 12.4565 12.016 12.7625 12.2613 13.8781C13.3723 18.9305 13.9301 21.4435 15.2014 21.4996C17.2278 21.5892 23.1733 5.342 21.0477 3.05293Z"}],["path",{"d":"M11.4999 12.5L14.9999 9"}]],"Thread":[["path",{"d":"M4.5 7.5H16.5C18.3856 7.5 19.3284 7.5 19.9142 8.08579C20.5 8.67157 20.5 9.61438 20.5 11.5V12.5M16.5 10.5H4.5M16.5 13.5H4.5M16.5 16.5H4.5"}],["path",{"d":"M15.4999 19.5002H5.49988C4.39531 19.5002 3.49988 20.3956 3.49988 21.5002H17.4999C17.4999 20.3956 16.6044 19.5002 15.4999 19.5002Z"}],["path",{"d":"M5.49988 4.49969L15.4999 4.49969C16.6044 4.49969 17.4999 3.60426 17.4999 2.49969L3.49988 2.49969C3.49988 3.60426 4.39531 4.49969 5.49988 4.49969Z"}]],"RightToLeftListBullet":[["path",{"d":"M3.87949 5.5L15.8795 5.5"}],["path",{"opacity":"0.4","d":"M3.87949 12.5L15.8795 12.5"}],["path",{"d":"M3.87949 19.5L15.8795 19.5"}],["path",{"opacity":"0.4","d":"M20.0045 5.5H19.8795M20.1295 5.5C20.1295 5.63807 20.0176 5.75 19.8795 5.75C19.7414 5.75 19.6295 5.63807 19.6295 5.5C19.6295 5.36193 19.7414 5.25 19.8795 5.25C20.0176 5.25 20.1295 5.36193 20.1295 5.5Z"}],["path",{"opacity":"0.4","d":"M20.0045 12.5H19.8795M20.1295 12.5C20.1295 12.6381 20.0176 12.75 19.8795 12.75C19.7414 12.75 19.6295 12.6381 19.6295 12.5C19.6295 12.3619 19.7414 12.25 19.8795 12.25C20.0176 12.25 20.1295 12.3619 20.1295 12.5Z"}],["path",{"opacity":"0.4","d":"M20.0045 19.5H19.8795M20.1295 19.5C20.1295 19.6381 20.0176 19.75 19.8795 19.75C19.7414 19.75 19.6295 19.6381 19.6295 19.5C19.6295 19.3619 19.7414 19.25 19.8795 19.25C20.0176 19.25 20.1295 19.3619 20.1295 19.5Z"}]],"InformationCircle":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16V12"}],["path",{"d":"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z"}]],"BookOpen01":[["path",{"d":"M7.99978 3.5H6.60021C4.43183 3.5 3.34764 3.5 2.67399 4.17362C2.00034 4.84724 2.00029 5.93144 2.00021 8.09982L2 13.3998C1.99992 15.5684 1.99987 16.6526 2.67353 17.3263C3.34719 18 4.43146 18 6.6 18H8.95042C10.4329 18 11.7092 19.0464 11.9999 20.5V5.5C11.0556 4.24097 9.99989 3.5 7.99978 3.5Z"}],["path",{"d":"M16.0001 3.5H17.3997C19.5681 3.5 20.6523 3.5 21.3259 4.17362C21.9996 4.84724 21.9996 5.93144 21.9997 8.09982L21.9999 13.3998C22 15.5684 22 16.6526 21.3264 17.3263C20.6527 18 19.5684 18 17.3999 18H15.0495C13.567 18 12.2907 19.0464 12 20.5V5.5C12.9443 4.24097 14 3.5 16.0001 3.5Z"}]],"Layers01":[["path",{"d":"M8.64298 3.14559L6.93816 3.93362C4.31272 5.14719 3 5.75397 3 6.75C3 7.74603 4.31272 8.35281 6.93817 9.56638L8.64298 10.3544C10.2952 11.1181 11.1214 11.5 12 11.5C12.8786 11.5 13.7048 11.1181 15.357 10.3544L17.0618 9.56638C19.6873 8.35281 21 7.74603 21 6.75C21 5.75397 19.6873 5.14719 17.0618 3.93362L15.357 3.14559C13.7048 2.38186 12.8786 2 12 2C11.1214 2 10.2952 2.38186 8.64298 3.14559Z"}],["path",{"d":"M20.788 11.0972C20.9293 11.2959 21 11.5031 21 11.7309C21 12.7127 19.6873 13.3109 17.0618 14.5072L15.357 15.284C13.7048 16.0368 12.8786 16.4133 12 16.4133C11.1214 16.4133 10.2952 16.0368 8.64298 15.284L6.93817 14.5072C4.31272 13.3109 3 12.7127 3 11.7309C3 11.5031 3.07067 11.2959 3.212 11.0972"}],["path",{"d":"M20.3767 16.2661C20.7922 16.5971 21 16.927 21 17.3176C21 18.2995 19.6873 18.8976 17.0618 20.0939L15.357 20.8707C13.7048 21.6236 12.8786 22 12 22C11.1214 22 10.2952 21.6236 8.64298 20.8707L6.93817 20.0939C4.31272 18.8976 3 18.2995 3 17.3176C3 16.927 3.20778 16.5971 3.62334 16.2661"}]],"Pin":[["path",{"d":"M3 21L8 16"}],["path",{"d":"M13.2585 18.8714C9.51516 18.0215 5.97844 14.4848 5.12853 10.7415C4.99399 10.1489 4.92672 9.85266 5.12161 9.37197C5.3165 8.89129 5.55457 8.74255 6.03071 8.44509C7.10705 7.77265 8.27254 7.55888 9.48209 7.66586C11.1793 7.81598 12.0279 7.89104 12.4512 7.67048C12.8746 7.44991 13.1622 6.93417 13.7376 5.90269L14.4664 4.59604C14.9465 3.73528 15.1866 3.3049 15.7513 3.10202C16.316 2.89913 16.6558 3.02199 17.3355 3.26771C18.9249 3.84236 20.1576 5.07505 20.7323 6.66449C20.978 7.34417 21.1009 7.68401 20.898 8.2487C20.6951 8.8134 20.2647 9.05346 19.4039 9.53358L18.0672 10.2792C17.0376 10.8534 16.5229 11.1406 16.3024 11.568C16.0819 11.9955 16.162 12.8256 16.3221 14.4859C16.4399 15.7068 16.2369 16.88 15.5555 17.9697C15.2577 18.4458 15.1088 18.6839 14.6283 18.8786C14.1477 19.0733 13.8513 19.006 13.2585 18.8714Z"}]]};
const TYPE_ICON = { ayah: 'Quran03', hadith: 'QuoteDown', athar: 'Footprints', scholar: 'QuillWrite01', link: 'Link01', hidaya: 'Compass' };

/* ---------------------------------------------------------------- helpers */
const BASE = '../../content/';
const BAR = 56;
const SVGNS = 'http://www.w3.org/2000/svg';
const NF = new Intl.NumberFormat('ar-EG', { useGrouping: false });
const dig = n => NF.format(n);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isWide = () => window.innerWidth >= 1024;
const ayNo = k => +k.split(':')[1];
const LEAD_PUNCT = /^\s*[.!?؟؛;:،,]+\s*/;
const stripMarks = s => s.replace(/[ً-ْٰـ]/g, '').replace(/[أإآٱ]/g, 'ا').trim();

function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  return put(e, kids);
}
/* append that skips empty values and flattens lists (Element.append would print them) */
function put(e, ...kids) {
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
function ico(name, size) {
  const d = ICONS[name]; if (!d) return null;
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size || 18); s.setAttribute('height', size || 18);
  s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); s.setAttribute('class', 'hi');
  for (const n of d) { const e = document.createElementNS(SVGNS, n[0]); for (const k in n[1]) e.setAttribute(k, n[1][k]); s.appendChild(e); }
  return s;
}
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
};
async function getJSON(p) { const r = await fetch(BASE + p); if (!r.ok) throw new Error(p); return r.json(); }

const S = {
  ui: null, index: null, cache: new Map(),
  d: null, no: 93, depth: 1, model: null,
  cur: null, curSec: null,
  ctx: { tab: 'passage', source: null, term: null, thread: [], back: null, weaveMsg: false },
  pop: null, hc: null, hcTimer: 0, io: null, slabIO: null
};

/* ---------------------------------------------------------------- data model */
function segsOf(b) { return b.type === 'details' ? b.title.concat(b.blocks.flatMap(segsOf)) : (b.segments || []); }
const flat = segs => segs.filter(s => s.t === 'text' || s.t === 'term').map(s => s.v).join('').trim();
function questionOf(segs) { const t = flat(segs), i = t.indexOf('؟'); return i >= 0 ? t.slice(0, i + 1) : t; }

/* the ayah a depth item hangs from: the first ayah of the first record its title cites; none if that record is about the whole surah */
function anchorOf(d, b) {
  const no = d.surah.no;
  for (const s of b.title) {
    if (s.t !== 'mark') continue;
    for (const id of s.records) {
      const r = d.records[id]; if (!r) continue;
      const ks = (r.ayah_keys || []).filter(k => k.startsWith(no + ':'));
      if (ks.length && ks.length < d.main.length) return ks[0];
      if (ks.length) return null;
    }
  }
  return null;
}

function prep(d) {
  const no = d.surah.no;
  d.ayahMap = new Map(d.ayahs.map(a => [a.key, a]));
  d.main = d.ayahs.filter(a => a.key.startsWith(no + ':'));
  d.passages = d.passages || [];
  d.passOf = new Map(); d.passById = new Map();
  d.passages.forEach((p, i) => {
    p.idx = i; p.keys = []; d.passById.set(p.id, p);
    for (let n = ayNo(p.from); n <= ayNo(p.to); n++) { const k = `${no}:${n}`; p.keys.push(k); d.passOf.set(k, p); }
  });
  /* the surah's purpose: an interpretive-link record that is about every ayah of the surah */
  const whole = Object.values(d.records).filter(r => r.icons.includes('link') && d.main.every(a => (r.ayah_keys || []).includes(a.key)));
  d.purpose = whole[0] || null;
  d.models = d.levels.slice().sort((x, y) => x.depth - y.depth).map(lv => buildLevel(d, lv));
  return d;
}

function buildLevel(d, lv) {
  const ui = S.ui, blocks = lv.blocks, P = d.passages;
  const resolve = b => {
    if (b.type !== 'paragraph' && b.type !== 'details') return null;
    if (b.kind === 'summary') return null;
    if (b.passage) return d.passById.get(b.passage) || null;
    if (b.type === 'details') { const a = anchorOf(d, b); return a ? d.passOf.get(a) || null : null; }
    if (b.ayahs && b.ayahs[0]) return d.passOf.get(b.ayahs[0]) || null;
    return null;
  };
  /* by passage only when every passage has text at this depth; otherwise the level is one unit over the whole surah
     (tags are not a filter: the glance level is tagged with its first passage but speaks about all of it) */
  const covered = new Set(blocks.map(resolve).filter(Boolean));
  const byPassage = P.length > 1 && P.every(p => covered.has(p));
  const ayBlock = blocks.find(b => b.type === 'ayah');
  const allKeys = (ayBlock ? ayBlock.keys : d.main.map(a => a.key)).filter(k => d.ayahMap.has(k));
  const m = { depth: lv.depth, sections: [], units: [], byPassage };
  let sec = null, unit = null, maxP = -1;
  const open = (kind, o) => { sec = Object.assign({ kind, idx: m.sections.length, units: [], keys: [], title: '', range: '' }, o); m.sections.push(sec); unit = null; return sec; };
  const add = (kind, o) => { unit = Object.assign({ kind, idx: m.units.length, id: `u${lv.depth}-${m.units.length}`, sec, depth: lv.depth, blocks: [], ayahs: [], title: '' }, o); sec.units.push(unit); m.units.push(unit); return unit; };
  if (!byPassage) open('whole', { title: ui.reader.unit_whole, keys: allKeys, range: countLabel(allKeys.length) });
  for (const b of blocks) {
    if (b.type === 'ayah') continue;
    if (b.kind === 'summary') { open('summary', { title: ui.summary.open }); add('summary', { title: ui.summary.open, blocks: [b] }); continue; }
    if (b.type === 'heading') { open('headed', { title: b.text }); add('heading', { title: b.text }); continue; }
    const p = resolve(b);
    if (byPassage && p && p.idx > maxP) { maxP = p.idx; open('passage', { title: p.title, keys: p.keys, passage: p, range: ayLabel(p.keys) }); }
    if (!sec) open('lead', {});
    if (b.type === 'details') { const a = anchorOf(d, b); add('details', { title: questionOf(b.title), full: b, blocks: [b], ayahs: a ? [a] : [] }); unit = null; }
    else if (b.title) add('stop', { title: b.title, blocks: [b], ayahs: (b.ayahs || []).filter(k => d.ayahMap.has(k)) });
    else { if (!unit) add('plain', {}); unit.blocks.push(b); }
  }
  return m;
}

function countLabel(n) { return `${dig(n)} ${n >= 3 && n <= 10 ? STR.ayah_few : STR.ayah_one}`; }
function ayShort(keys) {
  const ns = keys.map(ayNo);
  if (ns.length === 1) return dig(ns[0]);
  const run = ns.every((n, i) => i === 0 || n === ns[i - 1] + 1);
  return run ? `${dig(ns[0])}–${dig(ns[ns.length - 1])}` : ns.map(dig).join('، ');
}
function ayLabel(keys) { return `${keys.length === 1 ? S.ui.reader.unit_ayah : S.ui.reader.unit_ayahs} ${ayShort(keys)}`; }

function markIds(blocks) {
  const d = S.d, ids = [], seen = new Set();
  for (const b of blocks) for (const s of segsOf(b)) {
    const list = s.t === 'mark' ? s.records : s.t === 'quote' ? [s.record] : [];
    for (const id of list) if (d.records[id] && !seen.has(id)) { seen.add(id); ids.push(id); }
  }
  return ids;
}
function termsOf(blocks) {
  const d = S.d, out = [], seen = new Set();
  for (const b of blocks) for (const s of segsOf(b)) {
    if (s.t !== 'term' || seen.has(s.record) || !d.records[s.record]) continue;
    seen.add(s.record); out.push({ id: s.record, v: d.records[s.record].term || s.v, science: d.records[s.record].science || null });
  }
  return out;
}
function secInfo(sec) {
  if (sec._info) return sec._info;
  const d = S.d, blocks = sec.units.flatMap(u => u.blocks), ids = markIds(blocks);
  const types = {}, books = new Map();
  for (const id of ids) {
    const r = d.records[id], seen = new Set();
    r.icons.forEach(k => { types[k] = (types[k] || 0) + 1; });
    for (const e of r.evidence || []) {
      if (!e.source_title || seen.has(e.source_title)) continue;
      seen.add(e.source_title);
      let bk = books.get(e.source_title);
      if (!bk) books.set(e.source_title, bk = { title: e.source_title, icon: e.icon, ids: [], authors: new Set() });
      bk.ids.push(id); if (e.author) bk.authors.add(e.author);
    }
  }
  return (sec._info = { ids, types, books: [...books.values()].sort((a, b) => b.ids.length - a.ids.length), terms: termsOf(blocks) });
}
const unitPassage = u => u.sec.kind === 'passage' ? u.sec.passage : (u.ayahs[0] ? S.d.passOf.get(u.ayahs[0]) || null : null);

/* questions the reader can ask here: the titles of stops at the other depths of the same passage. Each one has its answer in the surah file. */
function followups(sec, max, skip) {
  const d = S.d, out = [], have = new Set(S.model.units.map(u => u.title));
  (skip || []).forEach(t => have.add(t));
  const order = [1, 2, -1, 3, -2, -3].map(x => S.depth + x).filter(x => x >= 0 && x < d.models.length);
  for (const dp of order) for (const u of d.models[dp].units) {
    if (u.kind !== 'stop' && u.kind !== 'details') continue;
    if (!u.title || !u.title.trim().endsWith('؟') || have.has(u.title)) continue;
    if (sec && sec.kind === 'passage' && unitPassage(u) !== sec.passage) continue;
    out.push(u); have.add(u.title);
    if (out.length >= max) return out;
  }
  return out;
}

/* ---------------------------------------------------------------- text rendering */
function chip(k) { const ic = S.ui.icons[k]; return h('span', { class: 'ic', 'data-k': k, style: `--tone:${ic.color}` }, ico(TYPE_ICON[k], 16)); }
function statuses(r) {
  const ui = S.ui, out = [];
  if (r.badge && ui.badges[r.badge]) out.push({ label: ui.badges[r.badge].label, tone: ui.badges[r.badge].color, meaning: ui.badges[r.badge].meaning });
  if (r.state && ui.states[r.state]) out.push({ label: ui.states[r.state].label, tone: ui.states[r.state].color, meaning: ui.states[r.state].meaning });
  if (!out.length) out.push({ label: ui.panel.no_badge, plain: true });
  return out;
}
const pill = st => h('span', { class: 'pill' + (st.plain ? ' plain' : ''), style: st.plain ? null : `--tone:${st.tone}` }, st.label);

function markInfo(ids) {
  const ui = S.ui, recs = ids.map(id => S.d.records[id]).filter(Boolean);
  return {
    recs,
    icons: ui.icon_order.filter(k => recs.some(r => r.icons.includes(k))),
    badge: ['la_yathbut', 'khilaf_mutabar'].find(b => recs.some(r => r.badge === b)) || null,
    state: (recs.find(r => r.state && ui.states[r.state]) || {}).state || null
  };
}
function markBtn(ids, runEl, o) {
  const ui = S.ui, { recs, icons, badge, state } = markInfo(ids);
  if (!recs.length) return null;
  const label = [ui.panel.title, icons.map(k => ui.icons[k].label).join('، '), badge ? ui.badges[badge].label : '', state ? ui.states[state].label : ''].filter(Boolean).join(' ');
  const b = h('button', { class: 'mk', type: 'button', 'aria-label': label },
    icons.map(chip),
    state ? h('span', { class: 'mk-dot', style: `--tone:${ui.states[state].color}` }) : null,
    badge ? h('span', { class: 'pill', style: `--tone:${ui.badges[badge].color}` }, ui.badges[badge].label) : null);
  b._ids = recs.map(r => r.id);
  b.addEventListener('click', () => { hideCard(); openSource({ ids: b._ids, run: runEl, mk: b, from: (o && o.from) || 'read' }); });
  b.addEventListener('mouseenter', () => { showCard(b, recs); if (runEl) runEl.classList.add('hot'); });
  b.addEventListener('mouseleave', () => { hideCard(); if (runEl) runEl.classList.remove('hot'); });
  b.addEventListener('focus', () => { if (b.matches(':focus-visible')) showCard(b, recs); });
  b.addEventListener('blur', hideCard);
  return b;
}
function termBtn(s) {
  const b = h('button', { class: 'term', type: 'button', title: S.ui.reader.open_term, 'data-term': s.record }, s.v);
  b.addEventListener('click', () => openTerm(s.record, b));
  return b;
}
/* a paragraph's segments. Each sentence (the text up to its marker) is one "run", so the marker can light the sentence it supports */
function renderSegs(segs, o) {
  const d = S.d, frag = document.createDocumentFragment();
  let run = null, afterMark = false, glue = null;
  const R = () => { if (!run) { run = h('span', { class: 'run' }); frag.append(run); } return run; };
  for (const s of segs) {
    if (s.t === 'text') {
      let v = s.v;
      if (afterMark) { const m = v.match(LEAD_PUNCT); if (m) { (glue || frag).append(m[0].trim()); if (/\s$/.test(m[0])) frag.append(' '); v = v.slice(m[0].length); } }
      if (v) R().append(s.q ? h('b', { class: 'dq' }, v) : v);
    } else if (s.t === 'ayah') {
      const a = d.ayahMap.get(s.key); if (a) R().append(h('span', { class: 'ay-in' }, a.text));
    } else if (s.t === 'quote') {
      const blk = s.v.length > 90;
      R().append(h('span', { class: 'q' + (blk ? ' blk' : /^["«“]/.test(s.v) ? '' : ' mark') }, s.v));
    } else if (s.t === 'term') {
      R().append(termBtn(s));
    } else if (s.t === 'mark') {
      const r = R(), mk = markBtn(s.records, r, o);
      glue = null;
      if (mk) {
        /* the marker stays on the line of the last word it follows */
        glue = h('span', { class: 'nw' });
        const last = r.lastChild;
        if (last && last.nodeType === 3) { const m = last.nodeValue.match(/^([\s\S]*\s)?(\S+)\s*$/); if (m) { last.nodeValue = m[1] || ''; glue.append(m[2]); } }
        else if (last && last.classList && last.classList.contains('term')) glue.append(last);
        glue.append(mk); r.append(glue);
      }
      run = null;
    }
    afterMark = s.t === 'mark';
    if (!afterMark) glue = null;
  }
  return frag;
}
function renderBlock(b, o) {
  if (b.role === 'example') return h('aside', { class: 'ex' }, h('p', { class: 'ex-l' }, S.ui.example.label), h('p', null, b.segments.map(s => s.v || '').join('')));
  return h('p', { class: 'para' }, renderSegs(b.segments || [], o));
}
function titleSegs(segs) {
  const out = segs.slice(), f = out[0];
  if (f && f.t === 'text') { const i = f.v.indexOf('؟'); if (i >= 0) out.splice(0, 1, { t: 'text', v: f.v.slice(0, i + 1), q: true }, { t: 'text', v: f.v.slice(i + 1) }); }
  return out;
}

/* ---------------------------------------------------------------- top bar */
function renderBar() {
  const ui = S.ui;
  $('#skip').textContent = STR.skip;
  $('#barStart').replaceChildren(
    h('button', { class: 'ib toc-btn', type: 'button', id: 'tocBtn', 'aria-label': STR.toc, title: STR.toc, 'aria-expanded': 'false', onclick: toggleToc }, ico('RightToLeftListBullet', 20)),
    h('span', { class: 'brand' }, ui.app_name),
    h('button', { class: 'pick', type: 'button', id: 'pick', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: ui.reader.surahs_title, onclick: e => togglePop(e.currentTarget, buildSurahs, { cls: 'surahs', label: ui.reader.surahs_title }) },
      h('span', { id: 'pickName' }), ico('ArrowDown01', 16)));
  $('#barMid').replaceChildren(
    h('div', { class: 'depth', role: 'group', 'aria-label': ui.reader.choose_depth, id: 'depth' },
      ui.levels.map(l => h('button', { type: 'button', 'data-d': l.depth, 'aria-pressed': 'false', title: `${l.name} (${l.depth + 1})`, onclick: () => setDepth(l.depth) }, l.name))));
  $('#barEnd').replaceChildren(
    h('button', { class: 'askbox', type: 'button', id: 'askBox', title: ui.ask.title, onclick: () => openAsk(true) },
      ico('BubbleChatQuestion', 18), h('span', { class: 't long' }, ui.ask.placeholder), h('span', { class: 't short' }, ui.ask.open), h('kbd', null, '/')),
    h('button', { class: 'ib', type: 'button', id: 'keyBtn', 'aria-label': ui.legend.title, title: ui.legend.title, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: e => togglePop(e.currentTarget, el => buildLegend(el), { cls: 'legend', label: ui.legend.title }) }, ico('Key01', 20)),
    h('button', { class: 'ib', type: 'button', id: 'kbdBtn', 'aria-label': STR.shortcuts, title: STR.shortcuts, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: e => togglePop(e.currentTarget, buildShortcuts, { cls: 'keys', label: STR.shortcuts }) }, ico('Keyboard', 20)),
    h('button', { class: 'ib', type: 'button', id: 'themeBtn', onclick: toggleTheme }),
    h('button', { class: 'ib', type: 'button', id: 'acctBtn', 'aria-label': STR.account, title: STR.account, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: e => togglePop(e.currentTarget, buildAccount, { cls: 'acct', label: STR.account }) }, ico('UserCircle', 20)),
    h('button', { class: 'ib', type: 'button', id: 'ctxBtn', 'aria-label': STR.panel_show, title: STR.panel_show, onclick: () => setCtxOpen(true) }, ico('SidebarLeft', 20)));
  syncTheme(); syncCtxBtn();
  $('#narrow').replaceChildren(h('div', null, h('b', null, ui.app_name), h('p', null, STR.narrow)));
}
function syncBar() {
  $('#pickName').textContent = `${S.ui.menu.surah_word} ${S.d.surah.name}`;
  $$('#depth button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.d === S.depth)));
}
const themeNow = () => document.documentElement.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function syncTheme() {
  const b = $('#themeBtn'), dark = themeNow() === 'dark', label = dark ? STR.theme_light : STR.theme_dark;
  b.replaceChildren(ico(dark ? 'Sun03' : 'Moon02', 20)); b.setAttribute('aria-label', label); b.title = label;
}
function toggleTheme() { const t = themeNow() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; store.set('huda.wide.theme', t); syncTheme(); }
function syncCtxBtn() {
  $('#ctxBtn').hidden = $('#shell').dataset.ctx === 'on';
}
function setCtxOpen(on) { $('#shell').dataset.ctx = on ? 'on' : 'off'; syncCtxBtn(); }
function toggleToc() { setToc($('#shell').dataset.toc !== 'on'); }
function setToc(on) {
  $('#shell').dataset.toc = on ? 'on' : 'off'; $('#tocScrim').hidden = !on;
  const b = $('#tocBtn'); if (b) b.setAttribute('aria-expanded', String(on));
}

/* ---------------------------------------------------------------- index column */
function renderToc() {
  const d = S.d, ui = S.ui, m = S.model, toc = $('#toc');
  toc.setAttribute('aria-label', STR.toc);
  const head = h('div', { class: 'toc-head' },
    h('div', { class: 'toc-title' }, h('span', { class: 'toc-name' }, d.surah.name), h('span', { class: 'toc-count num' }, countLabel(d.main.length))));
  if (d.purpose) {
    const run = h('span', { class: 'run' }, d.purpose.claim);
    put(head, h('p', { class: 'toc-lbl' }, STR.purpose), h('p', { class: 'toc-purpose' }, run, ' ', markBtn([d.purpose.id], run)));
  }
  const ol = h('div', { class: 'ol' });
  for (const sec of m.sections) {
    if (sec.title) {
      sec.tocEl = h('button', { class: 'ol-pass', type: 'button', onclick: () => { goSec(sec); setToc(false); } },
        h('span', null, sec.title), sec.kind === 'passage' ? h('span', { class: 'rng num' }, ayShort(sec.keys)) : null);
      put(ol, sec.tocEl);
    }
    const items = sec.units.filter(u => u.title && (u.kind === 'stop' || u.kind === 'details'));
    if (items.length) put(ol, h('ul', { class: 'ol-items' }, items.map(u => h('li', null,
      (u.tocEl = h('button', { class: 'ol-it', type: 'button', onclick: () => { goUnit(u, { open: true }); setToc(false); } },
        h('span', null, u.title), u.ayahs.length ? h('span', { class: 'n num' }, ayShort(u.ayahs)) : null))))));
  }
  const key = h('div', { class: 'toc-key' },
    h('button', { class: 'toc-key-h', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: e => togglePop(e.currentTarget, el => buildLegend(el), { cls: 'legend', label: ui.legend.title }) }, ico('Key01', 15), ui.legend.title),
    h('div', { class: 'keygrid' }, ui.icon_order.map(k => h('button', { type: 'button', title: ui.icons[k].meaning, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: e => togglePop(e.currentTarget, el => buildLegend(el, k), { cls: 'legend', label: ui.legend.title }) }, chip(k), ui.icons[k].short))));
  toc.replaceChildren(h('div', { class: 'toc-scroll', id: 'tocScroll' }, head, ol), key);
}

/* ---------------------------------------------------------------- reading column */
function renderDoc() {
  const d = S.d, ui = S.ui, m = S.model, doc = $('#doc');
  const hasDets = m.units.some(u => u.kind === 'details');
  const kids = [h('header', { class: 'doc-head' },
    h('h1', null, h('span', { class: 'w' }, ui.menu.surah_word), h('span', { class: 'n' }, d.surah.name)),
    h('div', { class: 'doc-meta' },
      h('p', { class: 'doc-note' }, ico('InformationCircle', 15), h('span', null, ui.disclosure.ai)),
      hasDets ? h('button', { class: 'lnk', type: 'button', id: 'allBtn', 'data-open': '0', onclick: toggleAllDets }, STR.expand_all) : null))];
  for (const sec of m.sections) kids.push(renderSec(sec));
  const i = S.index.surahs.findIndex(x => x.no === d.surah.no), nx = S.index.surahs[i + 1];
  kids.push(h('footer', { class: 'doc-foot' },
    nx ? h('a', { class: 'next', href: `?s=${nx.no}`, onclick: e => { e.preventDefault(); loadSurah(nx.no); } },
      h('span', null, ui.reader.next_surah, ' ', h('span', { class: 'nm' }, nx.name)), ico('ArrowLeft01', 20)) : null,
    h('div', { class: 'fine' }, h('p', null, ui.disclosure.scripture), h('p', null, ui.disclosure.limits), h('p', null, ui.privacy_line))));
  doc.replaceChildren(...kids);
  if (!$('#strip')) $('#read').prepend(h('div', { class: 'strip-wrap', 'aria-hidden': 'true' }, h('div', { class: 'strip', id: 'strip' }, h('div', { class: 'strip-in' }, h('span', { class: 'k num', id: 'stripK' }), h('span', { class: 't', id: 'stripT' })))));
}
function renderSec(sec) {
  const d = S.d, m = S.model;
  const el = h('section', { class: 'sec ' + sec.kind });
  if (sec.title) put(el, h('div', { class: 'sec-head' }, h('h2', null, sec.title), sec.range ? h('span', { class: 'rng num' }, sec.range) : null));
  sec.slabEl = null;
  if (sec.keys.length) {
    sec.slabEl = h('div', { class: 'slab' }, sec.keys.map(k => {
      const to = sec.units.find(u => u.ayahs.includes(k)) || m.units.find(u => u.ayahs.includes(k));
      const text = d.ayahMap.get(k).text;
      return [to ? h('a', { href: '#' + to.id, 'data-key': k, onclick: e => { e.preventDefault(); goUnit(to, { open: true }); } }, text) : h('span', { 'data-key': k }, text), ' '];
    }));
    put(el, sec.slabEl);
  }
  let group = null;
  for (const u of sec.units) {
    if (u.kind === 'details') { if (!group) { group = h('div', { class: 'dets' }); put(el, group); } put(group, renderDet(u)); }
    else { group = null; put(el, renderUnit(u)); }
  }
  sec.el = el;
  return el;
}
function renderUnit(u) {
  const el = h('article', { class: 'unit ' + u.kind, id: u.id, tabindex: '-1' });
  if (u.kind === 'stop') {
    if (u.ayahs.length) put(el, h('p', { class: 'u-k num' }, ayLabel(u.ayahs)));
    put(el, h('h3', null, u.title));
  }
  u.blocks.forEach(b => put(el, renderBlock(b)));
  u.el = el;
  return el;
}
function renderDet(u) {
  const b = u.full, bid = u.id + '-b';
  const body = h('div', { class: 'det-body', id: bid, hidden: true }, b.blocks.map(x => renderBlock(x)));
  const tg = h('button', { class: 'det-tg', type: 'button', 'aria-expanded': 'false', 'aria-controls': bid, 'aria-label': u.title, onclick: () => setDet(u, body.hidden) }, ico('PlusSign', 16));
  const title = h('div', { class: 'det-t' }, renderSegs(titleSegs(b.title)));
  title.addEventListener('click', e => { if (!e.target.closest('button')) setDet(u, body.hidden); });
  u.el = h('article', { class: 'unit det', id: u.id, tabindex: '-1' }, h('div', { class: 'det-head' }, tg, title), body);
  u.detBody = body; u.detTg = tg;
  return u.el;
}
function setDet(u, open) {
  if (!u.detBody) return;
  u.detBody.hidden = !open; u.detTg.setAttribute('aria-expanded', String(open)); u.detTg.replaceChildren(ico(open ? 'MinusSign' : 'PlusSign', 16));
}
function toggleAllDets() {
  const b = $('#allBtn'), open = b.dataset.open !== '1';
  S.model.units.forEach(u => setDet(u, open));
  b.dataset.open = open ? '1' : '0'; b.textContent = open ? STR.collapse_all : STR.expand_all;
}

/* ---------------------------------------------------------------- position: what is being read now */
const lineY = () => BAR + 150;
function watch() {
  if (S.io) S.io.disconnect();
  if (S.slabIO) S.slabIO.disconnect();
  if (!isWide() || !S.model) return;
  const line = lineY(), vh = window.innerHeight;
  S.io = new IntersectionObserver(track, { rootMargin: `-${line}px 0px -${Math.max(0, vh - line - 2)}px 0px` });
  S.model.units.forEach(u => S.io.observe(u.el));
  S.model.sections.forEach(s => S.io.observe(s.el));
  S.slabIO = new IntersectionObserver(es => { es.forEach(e => { e.target._vis = e.isIntersecting; }); syncStrip(); }, { rootMargin: `-${BAR + 24}px 0px 0px 0px`, threshold: 0.12 });
  S.model.sections.forEach(s => { if (s.slabEl) S.slabIO.observe(s.slabEl); });
  track();
}
function track() {
  const m = S.model, line = lineY() + 2;
  let sec = m.sections[0], unit = null;
  for (const s of m.sections) if (s.el.getBoundingClientRect().top <= line) sec = s;
  for (const u of sec.units) if (u.el.getBoundingClientRect().top <= line) unit = u;
  setCurrent(sec, unit);
}
function setCurrent(sec, unit) {
  const secChanged = sec !== S.curSec, unitChanged = unit !== S.cur;
  if (!secChanged && !unitChanged) return;
  S.curSec = sec; S.cur = unit;
  $$('#toc [aria-current]').forEach(e => e.removeAttribute('aria-current'));
  const mark = unit && unit.tocEl ? unit.tocEl : sec.tocEl;
  if (mark) {
    mark.setAttribute('aria-current', 'true');
    const box = $('#tocScroll'), r = mark.getBoundingClientRect(), br = box.getBoundingClientRect();
    if (r.top < br.top + 8) box.scrollTop -= br.top + 8 - r.top; else if (r.bottom > br.bottom - 8) box.scrollTop += r.bottom - br.bottom + 8;
  }
  $$('.slab .on').forEach(e => e.classList.remove('on'));
  if (unit) unit.ayahs.forEach(k => $$(`.slab [data-key="${k}"]`).forEach(e => e.classList.add('on')));
  syncStrip();
  const c = S.ctx;
  if (secChanged && (c.tab === 'passage' || (c.tab === 'source' && !c.source) || (c.tab === 'ask' && !c.thread.length))) renderCtxBody();
  if (unitChanged && c.tab === 'weave') renderCtxBody();
}
/* the ayah under discussion stays in sight: once its slab has scrolled away, a thin strip under the bar carries it */
function syncStrip() {
  const strip = $('#strip'); if (!strip) return;
  const u = S.cur, keys = u ? u.ayahs.filter(k => S.d.ayahMap.has(k)) : [];
  const slab = u && u.sec.slabEl;
  const show = !!u && keys.length > 0 && keys.length <= 3 && !(slab && slab._vis);
  if (show) { $('#stripK').textContent = ayLabel(keys); $('#stripT').textContent = keys.map(k => S.d.ayahMap.get(k).text).join(' '); }
  strip.classList.toggle('on', show);
}
function scrollToY(y, instant) { window.scrollTo({ top: Math.max(0, y), behavior: instant || reduced() ? 'instant' : 'smooth' }); }
function goUnit(u, o) {
  if (!u || !u.el) return;
  if (o && o.open && u.kind === 'details') setDet(u, true);
  scrollToY(u.el.getBoundingClientRect().top + window.scrollY - (BAR + 78), o && o.instant);
  if (o && o.focus) u.el.focus({ preventScroll: true });
}
function goSec(sec) { scrollToY(sec.el.getBoundingClientRect().top + window.scrollY - (BAR + 22)); }
function step(dir) {
  const us = S.model.units; if (!us.length) return;
  const i = S.cur ? S.cur.idx : (S.curSec && S.curSec.units[0] ? S.curSec.units[0].idx - 1 : -1);
  const n = Math.min(us.length - 1, Math.max(0, i + dir));
  goUnit(us[n], { focus: true });
}

/* changing the depth keeps the reader at the same ayah */
function setDepth(n) {
  if (n === S.depth || !S.d.models[n]) return;
  const prev = S.cur, prevSec = S.curSec;
  const key = (prev && prev.ayahs[0]) || (prevSec && prevSec.keys[0]) || null;
  const wasSummary = prev && prev.kind === 'summary';
  const atTop = window.scrollY < 80;
  const ref = prev ? prev.el : prevSec ? prevSec.el : null;
  const off = ref ? ref.getBoundingClientRect().top : BAR + 78;
  S.depth = n; store.set('huda.wide.depth', String(n));
  S.model = S.d.models[n]; S.cur = null; S.curSec = null;
  clearSource(); clearTerm(true);
  syncBar(); renderToc(); renderDoc(); syncUrl();
  if (atTop) scrollToY(0, true);
  else {
    const us = S.model.units;
    let t = null;
    if (wasSummary) t = us.find(u => u.kind === 'summary');
    if (!t && key) t = us.find(u => u.ayahs.includes(key)) || us.find(u => u.ayahs[0] && ayNo(u.ayahs[0]) >= ayNo(key));
    const el = t ? t.el : (key && (S.model.sections.find(s => s.keys.includes(key)) || {}).el) || null;
    if (el) scrollToY(el.getBoundingClientRect().top + window.scrollY - Math.min(Math.max(off, BAR + 70), window.innerHeight * 0.5), true);
    else scrollToY(0, true);
  }
  watch(); renderCtxBody();
}
function syncUrl() { try { history.replaceState(null, '', `?s=${S.no}&d=${S.depth}`); } catch (e) { /* file origin */ } }

/* ---------------------------------------------------------------- context panel */
const TABS = () => [['passage', STR.tab_passage], ['source', S.ui.panel.source], ['term', STR.tab_term], ['ask', S.ui.ask.open], ['weave', STR.tab_weave]];
function renderCtx() {
  const ui = S.ui, tabs = TABS();
  const list = h('div', { role: 'tablist', 'aria-label': STR.panel_show },
    tabs.map(([k, label]) => h('button', { class: 'tab', type: 'button', role: 'tab', id: 'tab-' + k, 'data-tab': k, 'aria-selected': 'false', 'aria-controls': 'ctxBody', tabindex: '-1', onclick: () => setTab(k) }, label)));
  list.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const ks = tabs.map(t => t[0]), i = ks.indexOf(S.ctx.tab), n = (i + (e.key === 'ArrowLeft' ? 1 : -1) + ks.length) % ks.length;
    e.preventDefault(); setTab(ks[n]); $('#tab-' + ks[n]).focus();
  });
  const form = h('form', { class: 'askform', onsubmit: e => { e.preventDefault(); const inp = $('#askInput'), q = inp.value.trim(); if (q) { inp.value = ''; ask(q, null); } } },
    h('input', { id: 'askInput', type: 'text', autocomplete: 'off', placeholder: ui.ask.placeholder, 'aria-label': ui.ask.title }),
    h('button', { class: 'btn primary', type: 'submit' }, ui.ask.submit));
  $('#ctx').replaceChildren(
    h('div', { class: 'ctx-tabs' }, list, h('button', { class: 'ib', type: 'button', 'aria-label': STR.panel_hide, title: STR.panel_hide, onclick: () => { setCtxOpen(false); $('#ctxBtn').focus(); } }, ico('SidebarLeft', 18))),
    h('div', { class: 'ctx-body', id: 'ctxBody', role: 'tabpanel', tabindex: '-1' }),
    h('div', { class: 'ctx-foot', id: 'ctxFoot', hidden: true }, form, h('p', { class: 'c-note' }, ui.ask.note)));
  $('#ctx').setAttribute('aria-label', STR.panel_show);
  renderCtxBody();
}
function setTab(k, o) {
  S.ctx.tab = k;
  renderCtxBody();
  if (o && o.focus) $('#ctxBody').focus({ preventScroll: true });
}
function renderCtxBody() {
  const c = S.ctx, body = $('#ctxBody'); if (!body) return;
  $$('#ctx .tab').forEach(t => { const on = t.dataset.tab === c.tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  body.setAttribute('aria-labelledby', 'tab-' + c.tab);
  $('#ctxFoot').hidden = c.tab !== 'ask';
  const keep = body.dataset.view === viewKey() ? body.scrollTop : 0;
  body.replaceChildren();
  ({ passage: viewPassage, source: viewSource, term: viewTerm, ask: viewAsk, weave: viewWeave })[c.tab](body);
  body.dataset.view = viewKey(); body.scrollTop = keep;
}
const viewKey = () => { const c = S.ctx; return [c.tab, c.tab === 'source' && c.source ? c.source.ids.join() : '', c.tab === 'term' && c.term ? c.term.id : '', c.tab === 'ask' ? c.thread.length : ''].join('|'); };
const curSec = () => S.curSec || S.model.sections[0];
const closeBtn = fn => h('button', { class: 'ib', type: 'button', 'aria-label': S.ui.panel.close, title: `${S.ui.panel.close} (Esc)`, onclick: fn }, ico('Cancel01', 18));

function bookRows(books) {
  return h('div', { class: 'rows' }, books.map(bk => h('button', { class: 'row', type: 'button', onclick: () => openSource({ ids: bk.ids, book: bk.title }) },
    chip(bk.icon && S.ui.icons[bk.icon] ? bk.icon : 'scholar'),
    h('span', { class: 'm' }, bk.title, bk.authors.size === 1 ? h('span', { class: 's' }, [...bk.authors][0]) : null),
    h('span', { class: 'c num' }, dig(bk.ids.length)), ico('ArrowLeft01', 16))));
}
function questionList(units) {
  return h('div', { class: 'qs' }, units.map(u => h('button', { class: 'qbtn', type: 'button', onclick: () => ask(u.title, u) },
    ico('BubbleChatQuestion', 16), h('span', null, u.title, h('span', { class: 'lv' }, `${S.ui.ask.from_level} ${S.ui.levels[u.depth].name}`)))));
}
function termGroups(terms) {
  const ui = S.ui, by = new Map();
  terms.forEach(t => { const k = t.science && ui.sciences[t.science] ? t.science : ''; if (!by.has(k)) by.set(k, []); by.get(k).push(t); });
  return [...by.entries()].map(([k, list]) => h('div', { class: 'sci' },
    h('p', { class: 'sci-n' }, k ? ui.sciences[k] : ui.terms_summary.other),
    h('div', { class: 'chips' }, list.map(t => h('button', { class: 'chip', type: 'button', onclick: () => openTerm(t.id, null) }, t.v)))));
}

function viewPassage(body) {
  const ui = S.ui, sec = curSec(), info = secInfo(sec);
  put(body, 
    h('p', { class: 'c-k' }, sec.kind === 'passage' ? `${ui.reader.passages_title} · ${dig(sec.passage.idx + 1)} / ${dig(S.d.passages.length)}` : ui.levels[S.depth].name),
    h('div', { class: 'c-h' }, h('h2', null, sec.title || `${ui.menu.surah_word} ${S.d.surah.name}`)),
    sec.range ? h('p', { class: 'c-sub num' }, sec.range) : null);
  const present = ui.icon_order.filter(k => info.types[k]);
  if (present.length) put(body, h('section', { class: 'c-sec' }, h('h3', null, ui.legend.icons_title),
    h('ul', { class: 'types' }, present.map(k => h('li', { title: ui.icons[k].meaning }, chip(k), h('span', null, ui.icons[k].label), h('span', { class: 'c num' }, dig(info.types[k])))))));
  if (info.books.length) put(body, h('section', { class: 'c-sec' },
    h('h3', null, STR.passage_sources, info.books.length > 5 ? h('button', { class: 'lnk', type: 'button', onclick: () => { clearSource(); setTab('source'); } }, `${STR.all_sources} (${dig(info.books.length)})`) : null),
    bookRows(info.books.slice(0, 5))));
  if (info.terms.length) put(body, h('section', { class: 'c-sec' }, h('h3', null, ui.terms_summary.terms), termGroups(info.terms)));
  const qs = followups(sec, 4);
  if (qs.length) put(body, h('section', { class: 'c-sec' }, h('h3', null, ui.ask.followups_title), questionList(qs)));
}

function evView(e) {
  const ui = S.ui, rows = [];
  if (e.author) rows.push(h('dt', null, ui.panel.author), h('dd', null, e.author));
  if (e.locator) rows.push(h('dt', null, ui.panel.locator), h('dd', null, e.locator));
  return h('div', { class: 'ev' },
    h('p', { class: 'ev-src' }, e.source_title),
    rows.length ? h('dl', { class: 'ev-meta' }, rows) : null,
    e.quote ? [h('p', { class: 'c-k', style: 'margin-top:8px' }, ui.panel.quote), h('blockquote', { class: 'ev-q', style: 'margin:4px 0 0' }, e.quote)] : null,
    e.rulings && e.rulings.length ? h('div', { class: 'ev-rul' }, h('p', { class: 'c-k' }, ui.panel.ruling), e.rulings.map(x => h('p', null, h('b', null, x.text), x.ruler ? ` · ${ui.panel.ruler}: ${x.ruler}` : ''))) : null,
    e.link_strength && ui.link_strength[e.link_strength] ? h('p', { class: 'c-note', style: 'margin-top:8px', title: ui.link_strength.note }, ui.link_strength[e.link_strength]) : null,
    e.url ? h('a', { class: 'lnk', href: e.url, target: '_blank', rel: 'noopener noreferrer' }, ui.panel.open_source, ico('ArrowUpRight01', 15)) : null);
}
function recView(r, book) {
  const ui = S.ui, evs = (book ? r.evidence.filter(e => e.source_title === book) : r.evidence) || [];
  const same = evs.some(e => e.quote && stripMarks(e.quote) === stripMarks(r.claim || ''));
  const sts = statuses(r);
  const lines = (r.status_text || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) sts.forEach(s => { if (s.meaning) lines.push(s.meaning); });
  return h('section', { class: 'rec' },
    h('div', { class: 'rec-top' }, r.icons.map(chip), h('span', { class: 'rec-type' }, r.icons.map(k => ui.icons[k].label).join('، ')), h('span', { style: 'display:inline-flex;gap:6px;margin-inline-start:auto;flex-wrap:wrap' }, sts.map(pill))),
    lines.length ? h('div', { class: 'rec-status' }, lines.map(l => h('p', null, l))) : null,
    r.claim && !same ? h('p', { class: 'rec-claim' }, h('span', { class: 'c-k', style: 'display:block' }, ui.panel.claim), r.claim) : null,
    evs.map(evView));
}
function viewSource(body) {
  const ui = S.ui, c = S.ctx, src = c.source;
  if (!src) {
    const sec = curSec(), info = secInfo(sec);
    put(body, h('div', { class: 'c-h' }, h('h2', null, ui.panel.title)), h('p', { class: 'c-hint', style: 'margin-top:6px' }, STR.source_hint),
      h('section', { class: 'c-sec' }, h('h3', null, STR.passage_sources, h('span', { class: 'num' }, dig(info.books.length))), bookRows(info.books)));
    return;
  }
  put(body, 
    src.book ? h('p', { class: 'c-k' }, `${ui.panel.sources_count}: ${dig(src.ids.length)}`) : null,
    h('div', { class: 'c-h' }, h('h2', null, src.book || ui.panel.title), closeBtn(() => closeDetail())),
    src.forEl ? h('div', { class: 'for' }, h('span', { class: 'c-k' }, ui.panel.for_text), src.forEl) : null,
    src.ids.map(id => recView(S.d.records[id], src.book)));
}
function runClone(run) {
  const c = run.cloneNode(true);
  $$('button', c).forEach(b => b.replaceWith(document.createTextNode(b.classList.contains('term') ? b.textContent : '')));
  c.className = '';
  return c;
}
function clearSource() {
  const s = S.ctx.source;
  $$('.run.on, .mk.on').forEach(e => e.classList.remove('on'));
  S.ctx.source = null; S.ctx.back = null;
  return s;
}
function openSource(o) {
  clearSource();
  S.ctx.source = { ids: o.ids, book: o.book || null, forEl: o.run ? runClone(o.run) : null, mk: o.mk || null };
  S.ctx.back = o.from === 'ask' ? 'ask' : null;
  if (o.from !== 'ask') { if (o.run) o.run.classList.add('on'); if (o.mk) o.mk.classList.add('on'); }
  setCtxOpen(true); setTab('source');
}
function clearTerm(silent) {
  $$('.term.on').forEach(e => e.classList.remove('on'));
  const t = S.ctx.term; S.ctx.term = null; return silent ? null : t;
}
function openTerm(id, btn) {
  clearTerm(true);
  S.ctx.term = { id, btn };
  $$(`#doc .term[data-term="${id}"]`).forEach(e => e.classList.add('on'));
  setCtxOpen(true); setTab('term');
}
function viewTerm(body) {
  const ui = S.ui, c = S.ctx;
  if (!c.term) {
    const terms = termsOf(S.model.units.flatMap(u => u.blocks));
    put(body, h('div', { class: 'c-h' }, h('h2', null, ui.terms_summary.title)), h('p', { class: 'c-hint', style: 'margin-top:6px' }, STR.term_hint),
      terms.length ? h('section', { class: 'c-sec' }, termGroups(terms)) : null);
    return;
  }
  const r = S.d.records[c.term.id];
  put(body, 
    r.science && ui.sciences[r.science] ? h('p', { class: 'c-k' }, `${ui.panel.science_of} ${ui.sciences[r.science]}`) : null,
    h('div', { class: 'c-h' }, h('h2', { class: 'term-name' }, r.term || (c.term.btn ? c.term.btn.textContent : '')), closeBtn(() => closeDetail())),
    h('p', { class: 'term-def' }, r.claim),
    h('div', { style: 'display:flex;gap:6px;margin-top:10px;flex-wrap:wrap' }, statuses(r).map(pill)),
    h('section', { class: 'rec' }, (r.evidence || []).map(evView)));
}

/* "ask" is a fixed demonstration: every offered question is the title of a stop at another depth, and its answer is that stop's own sentences with their markers */
function findUnit(q) {
  const n = stripMarks(q).replace(/[؟?]/g, '');
  for (const m of S.d.models) for (const u of m.units) if (u.title && (u.kind === 'stop' || u.kind === 'details') && stripMarks(u.title).replace(/[؟?]/g, '') === n) return u;
  return null;
}
function ask(q, unit) {
  const item = { q, unit: unit || findUnit(q), loading: true };
  S.ctx.thread.push(item);
  setCtxOpen(true); setTab('ask');
  const done = () => { item.loading = false; if (S.ctx.tab === 'ask') { renderCtxBody(); scrollThread(); } };
  scrollThread();
  if (reduced()) done(); else setTimeout(done, 700);
}
function scrollThread() { const b = $('#ctxBody'), last = b.querySelector('.qa:last-of-type'); if (last) b.scrollTop = Math.max(0, last.offsetTop - 12); }
function viewAsk(body) {
  const ui = S.ui, c = S.ctx;
  if (!c.thread.length) {
    const qs = followups(curSec(), 5);
    put(body, h('div', { class: 'c-h' }, h('h2', null, ui.ask.title)), h('p', { class: 'c-hint', style: 'margin-top:6px' }, ui.ask.note_sources),
      qs.length ? h('section', { class: 'c-sec' }, h('h3', null, ui.ask.starters_title), questionList(qs)) : null);
    return;
  }
  const thread = h('div', { class: 'thread' }, c.thread.map(it => {
    let a;
    if (it.loading) a = h('div', { class: 'qa-a qa-load' }, h('span', null, ui.ask.loading), h('i', { class: 'sk' }), h('i', { class: 'sk' }), h('i', { class: 'sk short' }));
    else if (!it.unit) a = h('div', { class: 'qa-a' }, h('p', { class: 'c-hint' }, ui.ask.unavailable));
    else {
      const u = it.unit, blocks = u.kind === 'details' ? [{ type: 'paragraph', segments: u.full.title }].concat(u.full.blocks) : u.blocks;
      a = h('div', { class: 'qa-a' },
        h('p', { class: 'qa-from' }, ui.ask.answer_title, h('span', { class: 'pill plain' }, `${ui.ask.from_level} ${ui.levels[u.depth].name}`)),
        blocks.map(b => renderBlock(b, { from: 'ask' })),
        h('button', { class: 'lnk', type: 'button', onclick: () => readInPlace(u) }, ui.reader.read_this, ico('ArrowLeft01', 15)));
    }
    return h('div', { class: 'qa' }, h('p', { class: 'c-k', style: 'margin-bottom:4px' }, ui.ask.your_question), h('div', { style: 'display:grid' }, h('p', { class: 'qa-q' }, it.q)), a);
  }));
  put(body, thread);
  const more = followups(curSec(), 3, c.thread.map(t => t.q));
  if (more.length && !c.thread[c.thread.length - 1].loading) put(body, h('section', { class: 'c-sec' }, h('h3', null, ui.ask.followups_title), questionList(more)));
}
function readInPlace(u) {
  const changed = u.depth !== S.depth;
  if (changed) setDepth(u.depth);
  const t = S.model.units[u.idx];
  requestAnimationFrame(() => goUnit(t, { open: true, instant: changed }));
}
function openAsk(focus) { setCtxOpen(true); setTab('ask'); if (focus) setTimeout(() => $('#askInput').focus(), 0); }

function viewWeave(body) {
  const ui = S.ui, c = S.ctx;
  const stop = S.cur && S.cur.title ? S.cur : S.model.units.find(u => u.kind === 'stop' && (!S.curSec || u.sec === S.curSec)) || S.model.units.find(u => u.title);
  put(body, h('p', { class: 'c-k' }, ui.weave.badge), h('div', { class: 'c-h' }, h('h2', null, stop ? stop.title : STR.tab_weave)), h('p', { class: 'c-hint', style: 'margin-top:6px' }, ui.weave.note));
  const qs = c.thread.map(t => t.q);
  put(body, h('section', { class: 'c-sec' }, h('h3', null, ui.ask.your_questions),
    qs.length ? h('div', { class: 'rows' }, qs.map(q => h('div', { class: 'row', style: 'cursor:default' }, ico('BubbleChatQuestion', 16), h('span', { class: 'm' }, q)))) : h('p', { class: 'c-hint' }, STR.weave_empty)));
  put(body, h('div', { style: 'margin-top:18px;display:grid;gap:10px;justify-items:start' },
    h('button', { class: 'btn primary', type: 'button', disabled: !qs.length, onclick: () => { c.weaveMsg = true; renderCtxBody(); } }, ico('Thread', 17), ui.weave.trigger),
    c.weaveMsg && qs.length ? h('p', { class: 'c-note', role: 'status' }, STR.weave_static) : null));
}

/* Esc: close what is open in the panel, and give focus back to where it came from */
function closeDetail() {
  const c = S.ctx;
  if (c.tab === 'source' && c.source) { const back = c.back, mk = c.source.mk; clearSource(); if (back === 'ask') setTab('ask'); else { renderCtxBody(); if (mk && mk.isConnected) mk.focus({ preventScroll: true }); } return true; }
  if (c.tab === 'term' && c.term) { const t = clearTerm(); renderCtxBody(); if (t && t.btn && t.btn.isConnected) t.btn.focus({ preventScroll: true }); return true; }
  if (c.tab !== 'passage') { setTab('passage'); return true; }
  return false;
}

/* ---------------------------------------------------------------- popovers */
function togglePop(opener, build, o) { if (S.pop && S.pop.opener === opener) { closePop(true); return; } openPop(opener, build, o); }
function openPop(opener, build, o) {
  closePop();
  const el = h('div', { class: 'pop ' + (o.cls || ''), role: 'dialog', 'aria-label': o.label, tabindex: '-1' });
  build(el);
  $('#layer').append(el);
  const r = opener.getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
  let x = Math.min(Math.max(8, r.right - w), vw - w - 8), y = r.bottom + 6;
  if (y + hh > vh - 8) y = r.top - hh - 6 > 8 ? r.top - hh - 6 : Math.max(8, vh - hh - 8);
  el.style.left = x + 'px'; el.style.top = y + 'px';
  S.pop = { el, opener }; opener.setAttribute('aria-expanded', 'true');
  (el.querySelector('input') || el).focus({ preventScroll: true });
}
function closePop(refocus) {
  const p = S.pop; if (!p) return;
  S.pop = null; p.el.remove(); p.opener.setAttribute('aria-expanded', 'false');
  if (refocus && p.opener.isConnected) p.opener.focus({ preventScroll: true });
}
const popHead = t => h('div', { class: 'pop-h' }, h('h2', null, t), closeBtn(() => closePop(true)));

function buildLegend(el, hl) {
  const ui = S.ui;
  put(el, popHead(ui.legend.title));
  const st = (o) => h('div', { class: 'lg st' }, pill({ label: o.label, tone: o.color }), h('span', { class: 'd' }, o.meaning));
  put(el, h('div', { class: 'lg-cols' },
    h('div', null, h('h3', null, ui.legend.icons_title), ui.icon_order.map(k => h('div', { class: 'lg' + (hl === k ? ' hl' : '') }, chip(k), h('div', null, h('b', null, ui.icons[k].label), h('span', { class: 'd' }, ui.icons[k].meaning))))),
    h('div', null, h('h3', null, ui.legend.badges_title), Object.values(ui.badges).map(st), Object.values(ui.states).map(st), st({ label: ui.panel.no_badge, color: 'var(--ink-3)', meaning: ui.link_strength.note }))));
}
function buildShortcuts(el) {
  const ui = S.ui, k = (...a) => h('span', { class: 'k' }, a.map(x => h('kbd', null, x)));
  put(el, popHead(STR.shortcuts), h('ul', null,
    h('li', null, ui.reader.next_stop, k('J', '←')),
    h('li', null, ui.reader.previous_stop, k('K', '→')),
    h('li', null, ui.reader.choose_depth, k('1', '2', '3', '4')),
    h('li', null, ui.ask.open, k('/')),
    h('li', null, ui.panel.close, k('Esc')),
    h('li', null, STR.shortcuts, k('?'))));
}
function buildAccount(el) {
  const ui = S.ui;
  put(el, h('button', { class: 'btn primary', type: 'button' }, ui.account.sign_in), h('button', { class: 'btn', type: 'button' }, ui.account.sign_up), h('p', { class: 'c-note' }, ui.privacy_line));
}
function buildSurahs(el) {
  const ui = S.ui;
  const list = h('div', { class: 'slist' });
  const fill = q => {
    const n = stripMarks(q || '');
    const rows = S.index.surahs.filter(s => !n || stripMarks(s.name).includes(n) || String(s.no) === n);
    list.replaceChildren(h('h3', { style: 'margin:10px 10px 4px' }, ui.menu.available_title),
      ...(rows.length ? rows.map(s => h('button', { type: 'button', 'aria-current': s.no === S.no ? 'true' : null, onclick: () => { closePop(); loadSurah(s.no); } },
        h('span', { class: 'no num' }, dig(s.no)), h('span', { class: 'nm' }, s.name), h('span', { class: 'ct num' }, countLabel(s.ayah_count)))) : [h('p', { class: 'c-hint', style: 'padding:8px 10px' }, ui.menu.no_results)]));
  };
  const inp = h('input', { type: 'text', autocomplete: 'off', placeholder: ui.menu.search_placeholder, 'aria-label': ui.menu.search_label, oninput: e => fill(e.target.value) });
  put(el, h('label', { class: 'find' }, ico('Search01', 17), inp), list, h('p', { class: 'c-note', style: 'padding:8px 10px 2px' }, ui.menu.scope_note));
  fill('');
}

/* the small card a marker shows on hover or keyboard focus: where the sentence comes from and its state */
function showCard(mk, recs) {
  clearTimeout(S.hcTimer);
  if (!S.hc) { S.hc = h('div', { class: 'hc', role: 'tooltip' }); $('#layer').append(S.hc); }
  const c = S.hc, shown = recs.slice(0, 3), sts = new Map();
  recs.forEach(r => statuses(r).forEach(s => sts.set(s.label, s)));
  c.replaceChildren(
    ...shown.map(r => { const e = (r.evidence || [])[0] || {}; return h('div', { class: 'hc-r' }, chip(r.icons[0]), h('div', null, h('b', null, e.source_title || S.ui.icons[r.icons[0]].label), e.author ? h('span', null, e.author) : null)); }),
    h('div', { class: 'hc-f' }, [...sts.values()].map(pill), recs.length > 3 ? h('span', { class: 'more num' }, `+${dig(recs.length - 3)}`) : null));
  const r = mk.getBoundingClientRect(), w = 300, hh = c.offsetHeight, vw = window.innerWidth;
  const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);
  const y = r.top - hh - 10 > BAR + 6 ? r.top - hh - 10 : r.bottom + 10;
  c.style.left = x + 'px'; c.style.top = y + 'px';
  S.hcTimer = setTimeout(() => c.classList.add('on'), 90);
}
function hideCard() { clearTimeout(S.hcTimer); if (S.hc) S.hc.classList.remove('on'); }

/* ---------------------------------------------------------------- keyboard */
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || !S.d || !isWide()) return;
  const t = e.target, typing = t && t.matches && t.matches('input, textarea, select, [contenteditable]');
  if (e.key === 'Escape') {
    hideCard();
    if (S.pop) { closePop(true); return; }
    if ($('#shell').dataset.toc === 'on') { setToc(false); return; }
    if (typing) t.blur();
    closeDetail();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); closePop(); openAsk(true); return; }
  if (e.key === '?') { e.preventDefault(); togglePop($('#kbdBtn'), buildShortcuts, { cls: 'keys', label: STR.shortcuts }); return; }
  if (S.pop) return;
  if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowLeft') { e.preventDefault(); step(1); }
  else if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowRight') { e.preventDefault(); step(-1); }
  else if (/^[1-4]$/.test(e.key)) { e.preventDefault(); setDepth(+e.key - 1); }
});
document.addEventListener('pointerdown', e => { if (S.pop && !S.pop.el.contains(e.target) && !S.pop.opener.contains(e.target)) closePop(); });
window.addEventListener('scroll', hideCard, { passive: true });

/* ---------------------------------------------------------------- load */
async function loadSurah(no) {
  const ui = S.ui;
  try {
    let d = S.cache.get(no);
    if (!d) { d = prep(await getJSON(`export/surah-${no}.json`)); S.cache.set(no, d); }
    S.d = d; S.no = no;
    if (!d.models[S.depth]) S.depth = 0;
    S.model = d.models[S.depth]; S.cur = null; S.curSec = null;
    S.ctx = { tab: 'passage', source: null, term: null, thread: [], back: null, weaveMsg: false };
    document.title = `${ui.app_name} · ${ui.menu.surah_word} ${d.surah.name}`;
    syncBar(); renderToc(); renderDoc(); renderCtx(); syncUrl();
    scrollToY(0, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(watch);
    watch();
  } catch (err) {
    $('#doc').replaceChildren(h('div', { class: 'err' }, h('p', null, STR.load_failed), h('button', { class: 'btn', type: 'button', onclick: () => loadSurah(no) }, ico('ArrowLeft01', 16), ui.reader.retry)));
    throw err;
  }
}
async function boot() {
  [S.ui, S.index] = await Promise.all([getJSON('ui.ar.json'), getJSON('export/index.json')]);
  const q = new URLSearchParams(location.search);
  const sd = q.get('d') != null ? +q.get('d') : +(store.get('huda.wide.depth') || 1);
  S.depth = sd >= 0 && sd <= 3 ? sd : 1;
  const no = +q.get('s') || 93;
  renderBar();
  $('#tocScrim').addEventListener('click', () => setToc(false));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
  let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { closePop(); if (window.innerWidth >= 1280) setToc(false); watch(); }, 120); });
  await loadSurah(S.index.surahs.some(s => s.no === no) ? no : S.index.surahs[0].no);
}
boot();
