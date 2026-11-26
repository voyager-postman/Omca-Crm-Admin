export const baseurl = 'https://mobappssolutiondevelopment.com/omca_crm/api/'  //server
export const image = 'https://mobappssolutiondevelopment.com/omca_crm/'  //server
export const imageUrl = 'https://mobappssolutiondevelopment.com/omca_crm/'  //server

export const resolveCrmImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw || raw === "null" || raw === "undefined") return "";
  if (raw.startsWith("blob:") || raw.startsWith("data:")) return raw;

  const base = image.endsWith("/") ? image : `${image}/`;
  if (raw.startsWith(base)) return raw;

  // Rewrite old deprecated domain if found
  if (/^https?:\/\/(www\.)?sisccltd\.com\/omca_crm\//i.test(raw)) {
    return raw.replace(/^https?:\/\/(www\.)?sisccltd\.com\/omca_crm\//i, base);
  }
  if (/^https?:\/\/(www\.)?sisccltd\.com\//i.test(raw)) {
    return raw.replace(/^https?:\/\/(www\.)?sisccltd\.com\//i, base);
  }

  // Preserve all other full URLs (such as https://omcacrm.com/... or third-party URLs)
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  // Relative path or file name
  const cleanPath = raw.replace(/^\/+/, "");
  return `${base}${cleanPath}`;
};

export const getDocFileUrl = (value) => resolveCrmImageUrl(value);

export const baseu11 = 'https://mobappssolutiondevelopment.com/omca_crm'  //server
/** Socket.IO host + path (proxied under /omca_crm) */
export const socketUrl = 'https://mobappssolutiondevelopment.com'
export const socketPath = '/omca_crm/socket.io'
export const excelExoprt = 'https://mobappssolutiondevelopment.com/'  //server
export const AdminBaseUrl = "https://omcacrm.com/omca/api/crm/"
export const AdminBaseUrl1 = "https://omcacrm.com/omca/api/"
// https://omcacrm.com/omca/api/crm
// export const AdminBaseUrl ="https://omcacrm.com/omca/api/crm/"
// export const baseurl = 'http://192.168.1.77:5201/api/'
// export const baseu11 = 'http://192.168.1.77:5201'
// export const excelExoprt = 'http://192.168.1.77:5201/api/'
// export const image = 'https://mobappssolutiondevelopment.com/omca_crm/'     
// export const imageUrl = 'http://192.168.1.77:5201/uploads/'  //local   
