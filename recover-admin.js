/* Local server maintenance only. No public HTTP reset endpoint or shared token. */
const readline=require('node:readline');
const {Writable}=require('node:stream');
async function main(){
  let username=String(process.env.BMT_ADMIN_USERNAME||'admin').trim().toLowerCase();
  let password=process.env.BMT_ADMIN_PASSWORD;
  if(!password){
    if(!process.stdin.isTTY){throw new Error('Chạy npm run admin:recover trong terminal tương tác; hoặc cung cấp BMT_ADMIN_PASSWORD qua biến môi trường riêng của máy chủ.');}
    let hidden=false;
    const output=new Writable({write(chunk,encoding,callback){if(!hidden)process.stdout.write(chunk);callback();}});
    const rl=readline.createInterface({input:process.stdin,output,terminal:true});
    const ask=q=>new Promise(resolve=>rl.question(q,resolve));
    try{
      username=(await ask('Tên tài khoản Admin [admin]: ')).trim().toLowerCase()||'admin';
      process.stdout.write('Mật khẩu mới (không hiển thị): ');hidden=true;password=await ask('');hidden=false;process.stdout.write('\n');
      process.stdout.write('Nhập lại mật khẩu: ');hidden=true;const repeat=await ask('');hidden=false;process.stdout.write('\n');
      if(password!==repeat)throw new Error('Hai mật khẩu không khớp. Chưa thay đổi tài khoản.');
    }finally{rl.close();}
  }
  if(!/^[a-z0-9_.-]{1,64}$/.test(username))throw new Error('Tên tài khoản không hợp lệ');
  if(typeof password!=='string'||password.length<8)throw new Error('Mật khẩu khôi phục cần ít nhất 8 ký tự');
  // Load the database only after input validation; do not touch tournament rows.
  const {db,findUserByUsername,createUser,resetUserPassword,updateUserRole}=require('./db');
  try{
    db.transaction(()=>{
      const existing=findUserByUsername(username);
      if(existing){resetUserPassword(existing.id,password);updateUserRole(existing.id,'admin');}
      else createUser({username,password,role:'admin',displayName:'Quản trị viên'});
    })();
    console.log(`Đã khôi phục quyền Admin cho tài khoản "${username}". Không thay đổi dữ liệu giải. Khởi động lại server rồi đăng nhập bằng mật khẩu vừa nhập.`);
  }finally{db.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
