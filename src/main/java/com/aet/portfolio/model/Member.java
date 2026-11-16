package com.aet.portfolio.model;

import java.util.ArrayList;
import java.util.List;

public class Member {
    private int id;
    private String name;
    private String section;
    private String school;
    private String grade;

    public String getSchool() { return school; }
    public void setSchool(String school) { this.school = school; }
    public String getGrade() { return grade; }
    public void setGrade(String grade) { this.grade = grade; }
    private String subject;
    private String tagline;
    private String folderLabel;
    private String deskItem;
    private ThemeSong themeSong;

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public ThemeSong getThemeSong() { return themeSong; }
    public void setThemeSong(ThemeSong themeSong) { this.themeSong = themeSong; }

    private String photo;
    private String coverColor;
    private List<PageContent> pages = new ArrayList<>();
    private List<Skill> skills = new ArrayList<>();

    public Member() {
    }

    public Member(int id, String name, String section, String subject, String tagline,
                  String folderLabel, String photo, String coverColor,
                  List<PageContent> pages, List<Skill> skills) {
        this.id = id;
        this.name = name;
        this.section = section;
        this.subject = subject;
        this.tagline = tagline;
        this.folderLabel = folderLabel;
        this.photo = photo;
        this.coverColor = coverColor;
        this.pages = pages != null ? pages : new ArrayList<>();
        this.skills = skills != null ? skills : new ArrayList<>();
    }

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSection() {
        return section;
    }

    public void setSection(String section) {
        this.section = section;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getTagline() {
        return tagline;
    }

    public void setTagline(String tagline) {
        this.tagline = tagline;
    }

    public String getFolderLabel() {
        return folderLabel;
    }

    public void setFolderLabel(String folderLabel) {
        this.folderLabel = folderLabel;
    }

    public String getDeskItem() {
        return deskItem;
    }

    public void setDeskItem(String deskItem) {
        this.deskItem = deskItem;
    }

    public String getPhoto() {
        return photo;
    }

    public void setPhoto(String photo) {
        this.photo = photo;
    }

    public String getCoverColor() {
        return coverColor;
    }

    public void setCoverColor(String coverColor) {
        this.coverColor = coverColor;
    }

    public List<PageContent> getPages() {
        return pages;
    }

    public void setPages(List<PageContent> pages) {
        this.pages = pages;
    }

    public List<Skill> getSkills() {
        return skills;
    }

    public void setSkills(List<Skill> skills) {
        this.skills = skills;
    }
}
