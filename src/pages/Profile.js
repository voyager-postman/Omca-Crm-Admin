import React from 'react'
import { Link } from 'react-router-dom'
import { GetUserData } from '../reducer/userSlice'
import { useSelector, useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import profile from '../img/doctor-03.jpg'
import user from '../img/user.jpg'
import { Formik, Field, ErrorMessage, Form } from "formik";
import { image } from '../Basurl/Baseurl'
import { isReferralUser, isInsuranceUser } from '../utils/authStorage'

export default function Profile() {
  const dispatch = useDispatch()
  const { getuser, loading, error } = useSelector((state) => state.getuser)

  const isRef =
    isReferralUser() ||
    getuser?.role?.toUpperCase() === "REFERRAL" ||
    getuser?.role?.toUpperCase() === "REFERRER" ||
    Boolean(getuser?.referral_id) ||
    Boolean(getuser?.isReferral);

  const isIns =
    isInsuranceUser() ||
    getuser?.role?.toUpperCase() === "INSURANCE" ||
    Boolean(getuser?.insurance_id) ||
    Boolean(getuser?.isInsurance);

  useEffect(() => {
    dispatch(GetUserData())
    console.log(error, getuser)
  }, [dispatch])
  console.log(getuser)
  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <div className="col-sm-7 col-6">
              <h4 className="page-title">My Profile</h4>
            </div>
          </div>
          <div className='card'>
            <div className='card-body'>
              <div className='user-hd'>
                <h6>User Information</h6>
                <Link to="/Admin/edit-profile"><i className="fa-solid fa-pen-to-square"></i></Link>
              </div>
              <div className='row align-items-center'>
                <div className='col-md-5'>
                  <div className="profile-sidebar">
                    <div className="top">
                      <form>
                        <div className="image-wrap">
                          <div
                            className="part-img"
                            style={{
                              width: "140px",
                              height: "140px",
                              minWidth: "140px",
                              minHeight: "140px",
                              maxWidth: "140px",
                              maxHeight: "140px",
                              borderRadius: "50%",
                              overflow: "hidden",
                              aspectRatio: "1 / 1",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              backgroundColor: "#f8fafc",
                              border: "3px solid #e2e8f0",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            }}
                          >
                            <img
                              src={
                                getuser?.profileImage
                                  ? `${image}${getuser.profileImage}`
                                  : user
                              }
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = user;
                              }}
                              alt={getuser?.name || "Profile"}
                              className='pro-img'
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                borderRadius: "50%",
                                aspectRatio: "1 / 1",
                                display: "block",
                              }}
                            />
                          </div>
                          <input type="file" className="form-control d-none" name="profile_pic" />
                        </div>
                      </form>
                      <div className="part-txt">
                        <h6 style={{ wordBreak: "break-word", maxWidth: "220px" }}>{getuser?.name}</h6>
                        <p>{getuser?.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className='col-md-7'>
                  <div className='user-info-main'>
                    <div className='table-responsive'>
                      <table className='table'>
                        <tbody>
                          {getuser?.referral_id && (
                            <tr>
                              <td>Referral ID:</td>
                              <td className='even'>{getuser.referral_id}</td>
                            </tr>
                          )}
                          {getuser?.insurance_id && (
                            <tr>
                              <td>Insurance ID:</td>
                              <td className='even'>{getuser.insurance_id}</td>
                            </tr>
                          )}
                          <tr>
                            <td>Phone:</td>
                            <td className='even'>{getuser?.phone_no || getuser?.phone || "-"}</td>
                          </tr>
                          <tr>
                            <td>Email:</td>
                            <td className='even'>{getuser?.email || "-"}</td>
                          </tr>
                          <tr>
                            <td>Role:</td>
                            <td className='even'>{getuser?.role || "-"}</td>
                          </tr>
                          {!isRef && !isIns && (
                            <tr>
                              <td>Gender:</td>
                              <td className='even'>{getuser?.gender || "-"}</td>
                            </tr>
                          )}
                          {getuser?.linkedPatientsCount != null && (
                            <tr>
                              <td>Linked Patients:</td>
                              <td className='even'>{getuser.linkedPatientsCount}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}


{/* <div className="staff-id">Employee ID : DR-0001</div> */ }
{/* <div className="staff-msg"><a href="chat.html" className="btn btn-primary">Send
                            Message</a></div> */}
{/* <div className="profile-tabs">
    <ul className="nav nav-tabs nav-tabs-bottom">
      <li className="nav-item"><a className="nav-link active" href="#about-cont" data-toggle="tab">About</a>
      </li>
      <li className="nav-item"><a className="nav-link" href="#bottom-tab2" data-toggle="tab">Profile</a></li>
      <li className="nav-item"><a className="nav-link" href="#bottom-tab3" data-toggle="tab">Messages</a></li>
    </ul>
    <div className="tab-content">
      <div className="tab-pane show active" id="about-cont">
        <div className="row">
          <div className="col-md-12">
            <div className="card-box">
              <h3 className="card-title">Education Informations</h3>
              <div className="experience-box">
                <ul className="experience-list">
                  <li>
                    <div className="experience-user">
                      <div className="before-circle"></div>
                    </div>
                    <div className="experience-content">
                      <div className="timeline-content">
                        <a href="#/" className="name">International College of Medical
                          Science (UG)</a>
                        <div>MBBS</div>
                        <span className="time">2001 - 2003</span>
                      </div>
                    </div>
                  </li>
                  <li>
                    <div className="experience-user">
                      <div className="before-circle"></div>
                    </div>
                    <div className="experience-content">
                      <div className="timeline-content">
                        <a href="#/" className="name">International College of Medical
                          Science (PG)</a>
                        <div>MD - Obstetrics & Gynaecology</div>
                        <span className="time">1997 - 2001</span>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
            <div className="card-box mb-0">
              <h3 className="card-title">Experience</h3>
              <div className="experience-box">
                <ul className="experience-list">
                  <li>
                    <div className="experience-user">
                      <div className="before-circle"></div>
                    </div>
                    <div className="experience-content">
                      <div className="timeline-content">
                        <a href="#/" className="name">Consultant Gynecologist</a>
                        <span className="time">Jan 2014 - Present (4 years 8
                          months)</span>
                      </div>
                    </div>
                  </li>
                  <li>
                    <div className="experience-user">
                      <div className="before-circle"></div>
                    </div>
                    <div className="experience-content">
                      <div className="timeline-content">
                        <a href="#/" className="name">Consultant Gynecologist</a>
                        <span className="time">Jan 2009 - Present (6 years 1
                          month)</span>
                      </div>
                    </div>
                  </li>
                  <li>
                    <div className="experience-user">
                      <div className="before-circle"></div>
                    </div>
                    <div className="experience-content">
                      <div className="timeline-content">
                        <a href="#/" className="name">Consultant Gynecologist</a>
                        <span className="time">Jan 2004 - Present (5 years 2
                          months)</span>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="tab-pane" id="bottom-tab2">
        Tab content 2
      </div>
      <div className="tab-pane" id="bottom-tab3">
        Tab content 3
      </div>
    </div>
  </div> */}
