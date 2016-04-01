'use strict';

const gulp = require('gulp');
const useref = require('gulp-useref');
const gulpif = require('gulp-if');
const uglify = require('gulp-uglify');
const cleanCss = require('gulp-clean-css');
const clean = require('gulp-clean');
const ghPages = require('gulp-gh-pages');
const fs = require('fs');

gulp.task('clean', function() {
	return gulp.src('dist', {read: false})
		.pipe(clean());
})

gulp.task('compress', ['clean'], function() {
	return gulp.src('src/index.html')
		.pipe(useref())
		.pipe(gulpif('*.js', uglify({
			mangle: {toplevel: false},
			compress: {
				sequences: true,
				dead_code: true,
				conditionals: true,
				booleans: true,
				unused: true,
				if_return: true,
				join_vars: true,
				drop_console: true
			}})))
		.pipe(gulpif('*.css', cleanCss({keepSpecialComments: false})))
		.pipe(gulp.dest('dist'));
});

gulp.task('copy', ['compress'], function() {
	fs.writeFileSync('dist/CNAME', 'www.c64js.com');
	return gulp.src('src/fonts/**').pipe(gulp.dest('dist/fonts'));
});

gulp.task('default', ['clean', 'compress', 'copy']);

gulp.task('deploy', ['default'], function() {
	return gulp.src('./dist/**/*')
		.pipe(ghPages());
});